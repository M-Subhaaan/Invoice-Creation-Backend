const express = require("express");
const authController = require("../controllers/authController");
const poController = require("../controllers/poController");

const router = express.Router();

router.use(authController.protect);

router.get("/", poController.getAllPurchaseOrders);
router.get("/pos/invoices", poController.getPOsWithInvoices);
router.get("/opened/pos", poController.getOpenedPOs);
router.get("/:id", poController.getSinglePO);

router.post("/", poController.createPO);
router.patch(
  "/:id",
  authController.restrictTo("admin"),
  poController.updatePoStatus,
);

router.patch("/user-update/:id", poController.updatePO);

router.delete(
  "/:id",
  authController.restrictTo("admin"),
  poController.deletePo,
);
module.exports = router;
