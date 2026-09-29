const express = require("express");
const { requireAuth } = require("../middlewares/auth");
const cart = require("../controllers/cartController");

const router = express.Router();

router.use(requireAuth);

router.get("/", cart.showCart);
router.post("/items/:productId", cart.addItem);
router.post("/items/:productId/quantity", cart.updateItem);
router.post("/items/:productId/remove", cart.removeItem);

module.exports = router;
