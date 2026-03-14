const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      unique: true,
      trim: true,
    },

    sku: {
      type: String,
      unique: true,
      index: true,
    },

    description: {
      type: String,
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
    },

    unit: {
      type: String,
      default: "pcs",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.pre("save", async function () {
  // Only generate SKU if it doesn't already exist or if the name changed
  if (!this.sku || this.isModified("name")) {
    const slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // Replace spaces/special chars with hyphens
      .slice(0, 6); // Take first 6 characters

    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

    // Final SKU format: NAME-RANDOM (e.g., IPHON-X9A2)
    this.sku = `${slug.toUpperCase()}-${randomSuffix}`;
  }

  return;
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
