const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Invoice = require("../models/invoiceModel");
const PurchaseOrder = require("../models/poModel");

const { applyAPIFeatures } = require("../utils/applyApiFeatures");
const { getNextInvoiceNumber } = require("../utils/getCounterNumber");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllInvoices = catchAsync(async (req, res) => {
  let filter = {};
  if (req.user.role === "user") {
    // Users can see invoices they created OR invoices for POs they created
    const userPOs = await PurchaseOrder.find({
      createdBy: req.user._id,
    }).select("_id");
    const poIds = userPOs.map((po) => po._id);

    filter = {
      $or: [{ createdBy: req.user._id }, { purchaseOrder: { $in: poIds } }],
    };
  }
  let query = Invoice.find(filter);
  query = applyAPIFeatures(query, req.query);

  const invoices = await query
    .populate("purchaseOrder")
    .populate("vendor")
    .populate("items.product");

  res.status(200).json({
    status: "success",
    results: invoices.length,
    data: {
      invoices,
    },
  });
});

exports.getSingleInvoice = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const invoice = await Invoice.findById(id)
    .populate("purchaseOrder")
    .populate("vendor")
    .populate("items.product");

  if (!invoice) {
    return next(AppError("Invoice not Found with the ID", 404));
  }

  const isCreatorOfInvoice = invoice.createdBy?.equals(req.user._id);
  const isCreatorOfPO = invoice.purchaseOrder?.createdBy?.equals(req.user._id);

  if (req.user.role === "user" && !isCreatorOfInvoice && !isCreatorOfPO) {
    return next(
      AppError("You do not have permission to view this Invoice", 403),
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      invoice,
    },
  });
});

exports.createInvoice = catchAsync(async (req, res, next) => {
  const {
    poNumber,
    taxType,
    taxValue,
    discountType,
    discountValue,
    notes,
    items: reqItems,
  } = req.body;

  const invoiceNumber = await getNextInvoiceNumber();

  const files = req.files;

  let attachments = [];

  if (files && files.length > 0) {
    attachments = files.map((file) => ({
      url: `/${file.path.replace(/\\/g, "/")}`,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));
  }

  const po = await PurchaseOrder.findOne({ poNumber }).populate(
    "items.product",
  );

  if (!po) {
    return next(AppError("Purchase Order not found with the provided ID", 404));
  }

  if (po.invoiceCreatedStatus === "closed") {
    return next(AppError("Invoice has already been created for this PO", 400));
  }
  // user restriction

  if (req.user.role === "user" && !po.createdBy.equals(req.user._id)) {
    return next(AppError("You can only invoice your own Purchase Orders", 403));
  }

  if (req.user.role === "user" && po.status !== "approved") {
    return next(
      AppError("Invoice can only be created when PO is approved", 403),
    );
  }

  // parse user requested items if provided to allow editing quantity and price
  let parsedReqItems = [];
  if (reqItems) {
    try {
      parsedReqItems =
        typeof reqItems === "string" ? JSON.parse(reqItems) : reqItems;
    } catch (err) {
      return next(AppError("Invalid format for items", 400));
    }
  }
  // calculate items
  let items = [];
  let subtotal = 0;

  if (!po.items || po.items.length === 0) {
    return next(AppError("Purchase Order has no items", 400));
  }

  for (const item of po.items) {
    if (!item.product) return;

    const providedItem = parsedReqItems?.length
      ? parsedReqItems.find(
          (ri) =>
            ri.product === item.product._id.toString() ||
            ri.product === item.product.toString(),
        )
      : null;

    const productName = item.product.name;

    const quantity =
      providedItem && providedItem.quantity !== undefined
        ? Number(providedItem.quantity)
        : item.quantity;
    const price =
      providedItem && providedItem.price !== undefined
        ? Number(providedItem.price)
        : item.price || item.product.price;

    if (!quantity || quantity <= 0) continue;

    const total = Number((quantity * price).toFixed(2));

    items.push({
      product: item.product._id,
      quantity,
      price,
      total,
    });
    const invoicedQty = item.invoicedQuantity || 0;
    const remainingQty = item.quantity - invoicedQty;

    if (quantity > remainingQty) {
      return next(
        AppError(
          `Insufficient quantity for "${productName}". Requested: ${quantity}, Available: ${remainingQty}`,
          400,
        ),
      );
    }

    subtotal += total;

    item.invoicedQuantity = (item.invoicedQuantity || 0) + quantity;
  }

  const allCompleted = po.items.every(
    (item) => item.invoicedQuantity >= item.quantity,
  );

  if (allCompleted) {
    po.invoiceCreatedStatus = "closed";
  }

  if (items.length === 0) {
    return next(AppError("No valid items found in Purchase Order", 400));
  }

  subtotal = Number(subtotal.toFixed(2));
  // discount calculation
  let discount = 0;

  if (discountType === "percentage") {
    discount = (subtotal * discountValue) / 100;
  } else if (discountType === "fixed") {
    discount = discountValue;
  }

  let afterDiscount = subtotal - discount;

  // tax calculation
  let tax = 0;

  if (taxType === "percentage") {
    tax = (afterDiscount * taxValue) / 100;
  } else if (taxType === "fixed") {
    tax = taxValue;
  }

  const totalAmount = Number((afterDiscount + tax).toFixed(2));

  // create invoice
  const invoice = await Invoice.create({
    invoiceNumber,
    purchaseOrder: po._id,
    vendor: po.vendor,
    items,
    subtotal,
    discountType,
    discountValue,
    taxType,
    taxValue,
    totalAmount,
    billingAddress: po.billingAddress,
    shippingAddress: po.shippingAddress,
    notes,
    attachments,
    createdBy: req.user._id,
  });

  await po.save();
  res.status(201).json({
    status: "success",
    data: {
      invoice,
    },
  });
});

exports.updateInvoiceStatus = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const status = req.body.status;

  const allowedStatus = ["unpaid", "paid", "cancelled"];

  if (!allowedStatus.includes(status)) {
    return next(AppError("Invalid invoice status", 400));
  }

  const invoice = await Invoice.findById(id);

  if (!invoice) {
    return next(AppError("Invoice not Found with the ID", 404));
  }

  invoice.status = status;
  await invoice.save();
  const populatedInvoice = await Invoice.findById(invoice._id)
    .populate("purchaseOrder")
    .populate("vendor")
    .populate("items.product");

  res.status(200).json({
    status: "success",
    data: {
      invoice: populatedInvoice,
    },
  });
});

exports.deleteInvoice = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const invoice = await Invoice.findById(id);

  if (!invoice) {
    return next(AppError("Invoice Not Found with the ID", 404));
  }

  if (invoice.attachments && invoice.attachments.length > 0) {
    invoice.attachments.forEach((file) => {
      const filePath = path.join(__dirname, "..", file.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }

  await Invoice.findByIdAndDelete(id);
  res.status(200).json({
    status: "success",
    message: "Invoice Deleted Successfuly",
  });
});
