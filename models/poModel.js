const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        invoicedQuantity: {
          type: Number,
          default: 0,
        },
      },
    ],

    billingAddress: {
      type: String,
      required: true,
    },

    shippingAddress: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    sendEmailToVendor: {
      type: Boolean,
      default: false,
    },

    invoiceCreatedStatus: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
  },
  { timestamps: true },
);

purchaseOrderSchema.set("toObject", { virtuals: true });
purchaseOrderSchema.set("toJSON", { virtuals: true });

purchaseOrderSchema.virtual("invoices", {
  ref: "Invoice",
  localField: "_id",
  foreignField: "purchaseOrder",
});

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);

module.exports = PurchaseOrder;
