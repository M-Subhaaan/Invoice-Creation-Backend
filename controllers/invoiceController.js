const mongoose = require("mongoose");
const Invoice = require("../models/invoiceModel");
const PurchaseOrder = require("../models/poModel");

const { applyAPIFeatures } = require("../utils/applyApiFeatures");
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
    purchaseOrderId,
    taxType,
    taxValue,
    discountType,
    discountValue,
    notes,
  } = req.body;

  const files = req.files;

  let attachments = [];

  if (files && files.length > 0) {
    attachments = files.map((file) => ({
      url: file.path,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));
  }

  if (!purchaseOrderId || !mongoose.Types.ObjectId.isValid(purchaseOrderId)) {
    return next(AppError("Please provide a valid Purchase Order ID", 400));
  }
  const po =
    await PurchaseOrder.findById(purchaseOrderId).populate("items.product");

  if (!po) {
    return next(AppError("Purchase Order not found with the provided ID", 404));
  }

  const existingInvoice = await Invoice.findOne({
    purchaseOrder: purchaseOrderId,
  });

  if (existingInvoice) {
    return next(
      AppError("Invoice already exists for this Purchase Order", 400),
    );
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

  // calculate items
  let items = [];
  let subtotal = 0;

  if (!po.items || po.items.length === 0) {
    return next(AppError("Purchase Order has no items", 400));
  }

  po.items.forEach((item) => {
    if (!item.product) return;

    const total = Number(
      (item.quantity * (item.price || item.product.price || 0)).toFixed(2),
    );

    items.push({
      product: item.product._id,
      quantity: item.quantity,
      price: item.price || item.product.price,
      total,
    });

    subtotal += total;
  });

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

  res.status(200).json({
    status: "success",
    data: {
      invoice,
    },
  });
});

exports.deleteInvoice = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const invoice = await Invoice.findByIdAndDelete(id);

  if (!invoice) {
    return next(AppError("Invoice Not Found with the ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Invoice Deleted Successfuly",
  });
});
