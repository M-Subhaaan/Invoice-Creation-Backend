const mongoose = require("mongoose");
const validator = require("validator");

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Vendor email is required"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please Provide a Valid Email Address"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Vendor phone is required"],
      validate: {
        validator: function (v) {
          return validator.isMobilePhone(v, "any");
        },
        message: "Invalid phone number",
      },
    },

    address: {
      type: String,
      required: true,
    },

    companyName: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

const Vendor = mongoose.model("Vendor", vendorSchema);
module.exports = Vendor;
