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

  res.status(200).json({
    status: "success",
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
    return next(AppError("PO Not Found", 404));
  }
  if (req.user.role === "user" && !po.createdBy.equals(req.user._id)) {
    return next(AppError("Unauthorized Access", 403));
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
    return next(AppError("Required fields missing", 400));
  }

  const vendorExists = await Vendor.findById(vendor);
  if (!vendorExists) {
    return next(AppError("Vendor not found", 404));
  }

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product)
      return next(AppError(`Product not found: ${item.product}`, 404));
    if (product.stock < item.quantity) {
      return next(AppError(`Insufficient stock for "${product.name}".`, 400));
    }
  }

  //Create PO
  const po = await PurchaseOrder.create({
    vendor,
    items,
    billingAddress,
    shippingAddress,
    createdBy: req.user._id,
    sendEmailToVendor: !!sendEmailToVendor,
  });

  // Update Stocks
  for (const item of items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity },
    });
  }

  const populatedPO = await PurchaseOrder.findById(po._id)
    .populate("vendor", "name email phone")
    .populate("items.product", "name sku price")
    .populate("createdBy", "name email");

  // Send Email and Respond
  if (sendEmailToVendor) {
    const totalAmount = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

    try {
      await sendEmail({
        email: vendorExists.email,
        subject: `New Purchase Order #${po._id.toString().slice(-8).toUpperCase()}`,
        html: `<div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
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
          ${populatedPO.items
            .map(
              (item) => `
            <tr>
              <td style="padding:10px; border:1px solid #ddd;">${item.product.name}</td>
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
      <p style="margin-top:20px;">Thank you,<br/>Invoice Creation System</p>
    </div>

    <!-- Bottom -->
    <div style="background:#f1f5f9; text-align:center; padding:10px; font-size:12px; color:#777;">
      This is an automated email. Please do not reply.
    </div>

  </div>
</div>`,
      });
    } catch (err) {
      console.error("Email failed:", err.message);
    }
  }

  res.status(201).json({
    status: "success",
    data: {
      po: populatedPO,
    },
  });
});

exports.updatePoStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return next(AppError("Invalid status", 400));
  }

  const po = await PurchaseOrder.findById(id);
  if (!po) {
    return next(AppError("PO not found", 404));
  }

  if (po.status !== "rejected" && status === "rejected") {
    for (const item of po.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }
  } else if (po.status === "rejected" && status === "approved") {
    // Re-verify stock before approving a rejected PO
    for (const item of po.items) {
      const prod = await Product.findById(item.product);
      if (!prod || prod.stock < item.quantity) {
        return next(
          AppError(`Insufficient stock for "${prod?.name || "Product"}".`, 400),
        );
      }
    }
    for (const item of po.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }
  }

  po.status = status;
  await po.save();

  const populatedPO = await PurchaseOrder.findById(id).populate(
    "vendor items.product createdBy",
  );
  res.status(200).json({ status: "success", data: { po: populatedPO } });
});

exports.updatePO = catchAsync(async (req, res, next) => {
  const { items, billingAddress, shippingAddress } = req.body;
  const po = await PurchaseOrder.findById(req.params.id);

  if (!po) return next(AppError("PO not found", 404));
  if (!po.createdBy.equals(req.user._id))
    return next(AppError("Unauthorized", 403));
  if (po.status !== "pending")
    return next(AppError("Can only edit pending POs", 400));

  const now = new Date();
  const createdAt = new Date(po.createdAt);
  const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
  if (hoursDiff > 24)
    return next(
      AppError("PO can only be edited within 24 hours of creation", 400),
    );

  if (items) {
    // Restore old stock
    for (const item of po.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }
    // Validate and Deduct new stock
    for (const item of items) {
      const prod = await Product.findById(item.product);
      if (!prod || prod.stock < item.quantity) {
        return next(
          AppError(`Insufficient stock for "${prod?.name || "Product"}"`, 400),
        );
      }
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }
    po.items = items;
  }

  po.billingAddress = billingAddress || po.billingAddress;
  po.shippingAddress = shippingAddress || po.shippingAddress;
  await po.save();

  const populatedPO = await PurchaseOrder.findById(po._id).populate(
    "vendor items.product createdBy",
  );
  res.status(200).json({ status: "success", data: { po: populatedPO } });
});

exports.deletePo = catchAsync(async (req, res, next) => {
  const po = await PurchaseOrder.findById(req.params.id);
  if (!po) return next(AppError("PO not found", 404));

  if (req.user.role !== "admin" && !po.createdBy.equals(req.user._id)) {
    return next(AppError("Unauthorized delete attempt", 403));
  }

  if (po.status !== "rejected") {
    for (const item of po.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }
  }

  await PurchaseOrder.findByIdAndDelete(req.params.id);
  res
    .status(200)
    .json({ status: "success", message: "PO Deleted Successfuly" });
});
