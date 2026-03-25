const Vendor = require("../models/vendorModel");
const { applyAPIFeatures } = require("../utils/applyApiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllVendors = catchAsync(async (req, res) => {
  let filter = {};
  if (req.user.role === "user") {
    filter = { createdBy: req.user._id };
  }

  const vendors = await applyAPIFeatures(Vendor.find(filter), req.query);

  res.status(200).json({
    status: "success",
    results: vendors.length,
    data: {
      vendors,
    },
  });
});

exports.getSingleVendor = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const filter = {
    _id: id,
    ...(req.user.role === "user" && { createdBy: req.user._id }),
  };

  const vendor = await Vendor.findById(filter);

  if (!vendor) {
    return next(AppError("Vendor Not Found with the Provided ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      vendor,
    },
  });
});

exports.createVendor = catchAsync(async (req, res, next) => {
  const { name, email, phone, address, companyName } = req.body;

  if (!name || !email || !phone || !address || !companyName) {
    return next(AppError("All fields are required", 400));
  }

  const existingVendor = await Vendor.findOne({
    email,
    createdBy: req.user._id,
  });

  if (existingVendor) {
    return next(AppError("Vendor already exists with this email", 400));
  }
  const vendor = await Vendor.create({
    name,
    email,
    phone,
    address,
    companyName,
    createdBy: req.user._id,
  });

  res.status(201).json({
    status: "success",
    data: {
      vendor,
    },
  });
});

exports.updateVendor = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const { email, phone, address, status, companyName } = req.body;

  const filter = {
    _id: id,
    ...(req.user.role === "user" && { createdBy: req.user._id }),
  };

  const vendor = await Vendor.findById(filter);

  if (!vendor) {
    return next(AppError("You Can Only Edit Your Own Vendor", 404));
  }

  vendor.email = email || vendor.email;
  vendor.phone = phone || vendor.phone;
  vendor.address = address || vendor.address;
  vendor.companyName = companyName || vendor.companyName;
  vendor.status = status || vendor.status;
  await vendor.save();

  res.status(200).json({
    status: "success",
    data: {
      vendor,
    },
  });
});

exports.deleteVendor = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const vendor = await Vendor.findByIdAndDelete(id);

  if (!vendor) {
    return next(AppError("Vendor not Found with the Provided ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Vendor Deleted Successfuly",
  });
});
