const express = require("express");
const authController = require("../controllers/authController");
const invoiceController = require("../controllers/invoiceController");

const router = express.Router();

router.use(authController.protect);

router.get(
  "/",
  authController.restrictTo("admin"),
  invoiceController.getAllInvoices,
);

router.get("/:id", invoiceController.getSingleInvoice);

router.post("/", invoiceController.createInvoice);

router.patch(
  "/:id",
  authController.restrictTo("admin"),
  invoiceController.updateInvoiceStatus,
);

router.delete(
  "/:id",
  authController.restrictTo("admin"),
  invoiceController.deleteInvoice,
);

module.exports = router;
