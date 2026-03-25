const express = require("express");
const authController = require("../controllers/authController");
const invoiceController = require("../controllers/invoiceController");
const upload = require("../utils/multer");

const router = express.Router();

router.use(authController.protect);

router.get("/", invoiceController.getAllInvoices);

router.get("/:id", invoiceController.getSingleInvoice);

router.post(
  "/",
  upload.array("attachments", 5),
  invoiceController.createInvoice,
);

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
