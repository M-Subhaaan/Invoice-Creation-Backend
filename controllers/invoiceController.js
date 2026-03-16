const Invoice = require("../models/invoiceModel");
const PurchaseOrder = require("../models/poModel");

const { applyAPIFeatures } = require("../utils/applyApiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllInvoices = catchAsync(async (req, res) => {
  const query = Invoice.find().populate("purchaseOrder").populate("vendor");

  const invoices = await applyAPIFeatures(query, req.query);

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
    .populate("vendor");

  if (!invoice) {
    return next(AppError("Invoice not Found with the ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      invoice,
    },
  });
});

exports.createInvoice = catchAsync(async (req, res, next) => {
  const { purchaseOrderId, taxType, taxValue, discountType, discountValue } =
    req.body;

  const po =
    await PurchaseOrder.findById(purchaseOrderId).populate("items.product");

  if (!po) {
    return next(AppError("Purchase Order not found with the ID", 404));
  }

  // user restriction
  if (req.user.role === "user" && po.status !== "approved") {
    return next(
      AppError("Invoice can only be created when PO is approved", 403),
    );
  }

  // calculate items
  let items = [];
  let subtotal = 0;

  po.items.forEach((item) => {
    const total = item.quantity * item.price;

    items.push({
      product: item.product._id,
      quantity: item.quantity,
      price: item.price,
      total,
    });

    subtotal += total;
  });

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

  const totalAmount = afterDiscount + tax;

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
