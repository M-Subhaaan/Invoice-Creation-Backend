const Invoice = require("../models/invoiceModel");
const PurchaseOrder = require("../models/poModel");
const User = require("../models/userModel");
const Vendor = require("../models/vendorModel");
const Product = require("../models/productModel");

const catchAsync = require("../utils/catchAsync");

exports.getStats = catchAsync(async (req, res) => {
  const isUser = req.user.role === "user";
  const userId = req.user._id;

  const userFilter = isUser ? { createdBy: userId } : {};

  // Parallel aggregation for performance
  const [
    totalUsers,
    totalPOS,
    totalInvoices,
    totalVendors,
    totalProducts,
    revenueData,
    poValueData,
    invoicesByStatus,
  ] = await Promise.all([
    User.countDocuments(),
    PurchaseOrder.countDocuments(userFilter),
    Invoice.countDocuments(userFilter),
    Vendor.countDocuments(isUser ? { createdBy: userId } : {}), // Vendors are always scoped if we want user-specific
    Product.countDocuments(), // Products might remain global or be scoped, usually global

    // Calculate total revenue from PAID invoices
    Invoice.aggregate([
      { $match: { ...userFilter, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),

    // Calculate total value of all POs (sum of items price * quantity)
    PurchaseOrder.aggregate([
      { $match: userFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
    ]),

    // Breakdown for pie chart
    Invoice.aggregate([
      { $match: userFilter },
      { $group: { _id: "$status", value: { $sum: 1 } } },
    ]),
  ]);

  const totalRevenue = revenueData[0]?.total || 0;
  const totalPoValue = poValueData[0]?.total || 0;

  res.status(200).json({
    status: "success",
    data: {
      stats: {
        totalRevenue,
        totalPoValue,
        totalUsers: isUser ? undefined : totalUsers,
        totalPOs: totalPOS,
        totalInvoices,
        pendingInvoices: await Invoice.countDocuments({
          ...userFilter,
          status: "unpaid",
        }),
        totalVendors,
        totalProducts,
      },
      invoiceStatus: invoicesByStatus.map((item) => {
        const id = item._id || "unknown";
        return {
          name: id.charAt(0).toUpperCase() + id.slice(1),
          value: item.value,
          color:
            id === "paid" ? "#22c55e" : id === "unpaid" ? "#f59e0b" : "#ef4444",
        };
      }),
    },
  });
});
