const express = require("express");
const { requireAuth } = require("../middlewares/auth");
const orders = require("../controllers/orderController");

const router = express.Router();

router.use(requireAuth);

router.get("/:orderNumber", orders.showOrder);

module.exports = router;
