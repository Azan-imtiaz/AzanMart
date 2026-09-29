const express = require("express");
const { isLoggedIn } = require("../middlewares/isLoggedIn");
const shop = require("../controllers/shopController");

const router = express.Router();

router.get("/", shop.showHome);
router.get("/about", shop.showAbout);
router.get("/shop", isLoggedIn, shop.showShop);
router.post("/addToCart/:productid", isLoggedIn, shop.addToCart);
router.get("/cart", isLoggedIn, shop.showCart);

module.exports = router;
