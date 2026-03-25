const express = require("express");
const authController = require("../controllers/authController");
const statsController = require("../controllers/statsController");

const router = express.Router();

router.use(authController.protect);
router.get("/", statsController.getStats);

module.exports = router;
