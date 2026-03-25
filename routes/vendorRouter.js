const express = require("express");
const authController = require("../controllers/authController");
const vendorController = require("../controllers/vendorController");

const router = express.Router();

router.use(authController.protect);

router.get("/", vendorController.getAllVendors);
router.get("/:id", vendorController.getSingleVendor);

router.post("/", vendorController.createVendor);
router.patch(
  "/:id",
  authController.restrictTo("admin"),
  vendorController.updateVendor,
);

router.delete(
  "/:id",
  authController.restrictTo("admin"),
  vendorController.deleteVendor,
);

module.exports = router;
