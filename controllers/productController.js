const Product = require("../models/productModel");
const PurchaseOrder = require("../models/poModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { applyAPIFeatures } = require("../utils/applyApiFeatures");

exports.getProducts = catchAsync(async (req, res) => {
  const products = await applyAPIFeatures(Product.find(), req.query);

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products,
    },
  });
});

exports.getSingleProduct = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const product = await Product.findById(id);

  if (!product) {
    return next(AppError("No Product found with the Provided ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  const { name, description, price, unit, stock } = req.body;

  if (!name || !price) {
    return next(AppError("Product name and price are required", 400));
  }

  const existingProduct = await Product.findOne({ name });

  if (existingProduct) {
    return next(AppError("Product already exists", 400));
  }

  const product = await Product.create({
    name,
    description,
    price,
    unit,
    stock: stock !== undefined ? Number(stock) : 0,
    createdBy: req.user._id,
  });

  res.status(201).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const { name, description, price, unit, stock } = req.body;

  const product = await Product.findById(id);

  if (!product) {
    return next(AppError("Product not Found with the Provided ID", 404));
  }

  product.name = name || product.name;
  product.description = description || product.description;
  product.price = price || product.price;
  product.unit = unit || product.unit;
  if (stock !== undefined) product.stock = Number(stock);
  await product.save();

  res.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    return next(AppError("Product not Found with the Provided ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Product Deleted Successfuly",
  });
});

exports.getProductTracking = catchAsync(async (req, res, next) => {
  const productId = req.body.productId;

  const pos = await PurchaseOrder.find({ "items.product": productId })
    .select("poNumber items createdAt status")
    .populate("createdBy vendor");

  // Map POs to show only this product's quantity
  const tracking = pos.map((po) => {
    const item = po.items.find((i) => i.product.toString() === productId);
    return {
      poId: po._id,
      poNumber: po.poNumber,
      date: po.createdAt,
      status: po.status,
      quantityUsed: item.quantity,
      vendor: po.vendor,
      createdBy: po.createdBy,
    };
  });

  res.status(200).json({
    status: "success",
    results: tracking.length,
    data: { tracking },
  });
});
