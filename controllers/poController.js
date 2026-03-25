const PurchaseOrder = require("../models/poModel");
const Vendor = require("../models/vendorModel");
const Product = require("../models/productModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { applyAPIFeatures } = require("../utils/applyApiFeatures");
const sendEmail = require("../utils/email");

exports.getAllPurchaseOrders = catchAsync(async (req, res) => {
  let filter = {};
  if (req.user.role === "user") {
    filter = { createdBy: req.user._id };
  }

  let query = PurchaseOrder.find(filter);
  query = applyAPIFeatures(query, req.query);

  const POs = await query
    .populate("vendor", "name email")
    .populate("items.product", "name sku price")
    .populate("createdBy", "name email");

  const totalCount = await PurchaseOrder.countDocuments(filter);

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
    .populate("vendor", "name email phone")
    .populate("items.product", "name sku price")
    .populate("createdBy", "name email");

  if (!po) {
    return next(AppError("PO Not Found with the ID you Provided", 404));
  }

  if (req.user.role === "user" && !po.createdBy.equals(req.user._id)) {
    return next(AppError("You do not have permission to view this PO", 403));
  }

  res.status(200).json({
    status: "success",
    data: {
      po,
    },
  });
});

exports.createPO = catchAsync(async (req, res, next) => {
  const { vendor, items, billingAddress, shippingAddress, sendEmailToVendor } =
    req.body;

  if (
    !vendor ||
    !items ||
    !items.length ||
    !billingAddress ||
    !shippingAddress
  ) {
    return next(
      AppError(
        "Vendor, items, billingAddress, and shippingAddress are required",
        400,
      ),
    );
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
  }

  const po = await PurchaseOrder.create({
    vendor,
    items,
    billingAddress,
    shippingAddress,
    createdBy: req.user._id,
    sendEmailToVendor: !!sendEmailToVendor,
  });
  if (sendEmailToVendor) {
    const totalAmount = items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    const html = `
<div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:#2563eb; color:#fff; padding:20px; text-align:center;">
      <h2 style="margin:0;">New Purchase Order</h2>
      <p style="margin:5px 0 0;">PO #${po._id.toString().slice(-8).toUpperCase()}</p>
    </div>

    <!-- Body -->
    <div style="padding:20px;">
      
      <p>Hello <strong>${vendorExists.name}</strong>,</p>
      <p>A new purchase order has been created. Here are the details:</p>

      <!-- Summary -->
      <table style="width:100%; border-collapse:collapse; margin:15px 0;">
        <tr>
          <td style="padding:8px; font-weight:bold;">PO ID:</td>
          <td style="padding:8px;">${po._id}</td>
        </tr>
        <tr>
          <td style="padding:8px; font-weight:bold;">Total Amount:</td>
          <td style="padding:8px; color:#16a34a; font-weight:bold;">$${totalAmount}</td>
        </tr>
      </table>

      <!-- Items Table -->
      <h3 style="margin-bottom:10px;">Items</h3>
      <table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px; border:1px solid #ddd;">Product</th>
            <th style="padding:10px; border:1px solid #ddd;">Qty</th>
            <th style="padding:10px; border:1px solid #ddd;">Price</th>
            <th style="padding:10px; border:1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr>
              <td style="padding:10px; border:1px solid #ddd;">${item.product}</td>
              <td style="padding:10px; border:1px solid #ddd; text-align:center;">${item.quantity}</td>
              <td style="padding:10px; border:1px solid #ddd; text-align:right;">$${item.price}</td>
              <td style="padding:10px; border:1px solid #ddd; text-align:right;">$${item.price * item.quantity}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <!-- Addresses -->
      <div style="display:flex; justify-content:space-between; margin-top:20px;">
        <div style="width:48%;">
          <h4>Billing Address</h4>
          <p style="margin:0; color:#555;">${billingAddress}</p>
        </div>
        <div style="width:48%;">
          <h4>Shipping Address</h4>
          <p style="margin:0; color:#555;">${shippingAddress}</p>
        </div>
      </div>

      <!-- Footer -->
      <p style="margin-top:20px;">Thank you,<br/>Your Company</p>
    </div>

    <!-- Bottom -->
    <div style="background:#f1f5f9; text-align:center; padding:10px; font-size:12px; color:#777;">
      This is an automated email. Please do not reply.
    </div>

  </div>
</div>
`;
    try {
      await sendEmail({
        email: vendorExists.email,
        subject: `New Purchase Order #${po._id.toString().slice(-8).toUpperCase()}`,
        html,
      });
    } catch (error) {
      console.error("Email sending failed:", error.message);
    }
  }

  let populatedPO = await po.populate([
    { path: "vendor", select: "name email phone" },
    { path: "items.product", select: "name sku price" },
    { path: "createdBy", select: "name email" },
  ]);
  res.status(201).json({
    status: "success",
    data: {
      po: populatedPO,
    },
  });
});

exports.updatePoStatus = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const status = req.body.status;

  if (!["approved", "rejected"].includes(status)) {
    return next(AppError("Status must be 'approved' or 'rejected'", 400));
  }

  const po = await PurchaseOrder.findById(id).populate([
    { path: "vendor", select: "name email phone" },
    { path: "items.product", select: "name sku price" },
    { path: "createdBy", select: "name email" },
  ]);
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

exports.updatePO = catchAsync(async (req, res, next) => {
  const { items, billingAddress, shippingAddress } = req.body;
  const po = await PurchaseOrder.findById(req.params.id);

  if (!po) {
    return next(AppError("PO Not Found with the ID", 404));
  }

  // 1. Permission check
  if (!po.createdBy.equals(req.user._id)) {
    return next(AppError("You can only edit your own POs", 403));
  }

  // 2. Status check
  if (po.status !== "pending") {
    return next(AppError("Only pending POs can be edited", 400));
  }

  // 3. Time check (24h)
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const timeElapsed = Date.now() - new Date(po.createdAt).getTime();

  if (timeElapsed > oneDayInMs) {
    return next(AppError("PO editing window (24h) has expired", 400));
  }

  // 4. Update
  po.items = items || po.items;
  po.billingAddress = billingAddress || po.billingAddress;
  po.shippingAddress = shippingAddress || po.shippingAddress;
  po.updatedByUserAt = Date.now();
  po.updatedBy = req.user._id;

  await po.save();

  // 5. Populate
  let populatedPO;
  try {
    populatedPO = await po.populate([
      { path: "vendor", select: "name email phone" },
      { path: "items.product", select: "name price" },
      { path: "createdBy", select: "name email" },
    ]);
  } catch (err) {
    console.error("Population error in updatePO (user):", err);
    populatedPO = po;
  }

  res.status(200).json({
    status: "success",
    data: {
      po: populatedPO,
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
