const express = require("express");
const { requireAuth } = require("../middlewares/auth");
const shop = require("../controllers/shopController");

const router = express.Router();

router.get("/", shop.showHome);
router.get("/about", shop.showAbout);
router.get("/shop", shop.showShop);
router.post("/addToCart/:productid", requireAuth, shop.addToCart);
router.get("/cart", requireAuth, shop.showCart);

module.exports = router;
