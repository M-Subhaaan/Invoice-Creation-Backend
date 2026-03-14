const PurchaseOrder = require("../models/poModel");
const Vendor = require("../models/vendorModel");
const Product = require("../models/productModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { applyApiFeatures } = require("../utils/applyApiFeatures");

exports.getAllPurchaseOrders = catchAsync(async (req, res) => {
  const query = PurchaseOrder.find()
    .populate("vendor", "name email")
    .populate("items.product", "name sku");

  const POs = await applyApiFeatures(query, req.query);

  const totalCount = await Po.countDocuments();

  res.status(200).json({
    status: "success",
    totalCount,
    results: POs.length,
    data: {
      POs,
    },
  });
});

exports.getSinglePO = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const po = await PurchaseOrder.findById(id)
    .populate("vendor", "name email phone") // Fetching specific vendor details
    .populate("items.product", "name sku price");

  if (!po) {
    return next(AppError("PO Not Found with the ID you Provided", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      po,
    },
  });
});

exports.createPO = catchAsync(async (req, res, next) => {
  const { vendor, items } = req.body;

  if (!vendor || !items || !items.length) {
    return next(AppError("Vendor and items are required", 400));
  }

  const vendorExists = await Vendor.findById(vendor);
  if (!vendorExists) {
    return next(AppError("Vendor not found with the Provided ID", 404));
  }

  for (let i = 0; i < items.length; i++) {
    const productExists = await Product.findById(items[i].product);
    if (!productExists) {
      return next(AppError(`Product not found: ${items[i].product}`, 404));
    }

    const po = await PurchaseOrder.create({
      vendor,
      items,
      createdBy: req.user._id,
    });

    res.status(201).json({
      status: "success",
      data: {
        po,
      },
    });
  }
});

exports.updatePoStatus = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const status = req.body.status;

  if (!["approved", "rejected"].includes(status)) {
    return next(AppError("Status must be 'approved' or 'rejected'", 400));
  }

  const po = await PurchaseOrder.findById(id);
  if (!po) {
    return next(AppError("Purchase Order not found with the ID", 404));
  }

  po.status = status;
  await po.save();

  res.status(200).json({
    status: "success",
    data: {
      po,
    },
  });
});

exports.deletePo = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const po = await PurchaseOrder.findByIdAndDelete(id);

  if (!po) {
    return next(AppError("PO Not Found with the ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "PO Deleted Successfuly",
  });
});
