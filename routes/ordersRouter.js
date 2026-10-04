const express = require("express");
const { requireAuth } = require("../middlewares/auth");
const { rateLimit } = require("express-rate-limit");
const orders = require("../controllers/orderController");
const cryptoPayment = require("../controllers/cryptoPaymentController");

const router = express.Router();

router.use(requireAuth);

router.get("/", orders.listOrders);
router.get("/:orderNumber", orders.showOrder);

// Each confirmation asks the blockchain node, so keep the polling sensible
const confirmLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  skip: () => process.env.NODE_ENV === "test",
});

router.get("/:orderNumber/pay", cryptoPayment.showPaymentPage);
router.post("/:orderNumber/crypto", confirmLimiter, cryptoPayment.confirm);

module.exports = router;
