const express = require("express");
const authController = require("../controllers/authController");
const productController = require("../controllers/productController");

const router = express.Router();

router.use(authController.protect);

router.get("/", productController.getProducts);
router.get("/tracking", productController.getProductTracking);
router.get("/:id", productController.getSingleProduct);

router.post(
  "/",
  authController.restrictTo("admin"),
  productController.createProduct,
);

router.patch(
  "/:id",
  authController.restrictTo("admin"),
  productController.updateProduct,
);

router.delete(
  "/:id",
  authController.restrictTo("admin"),
  productController.deleteProduct,
);
module.exports = router;
