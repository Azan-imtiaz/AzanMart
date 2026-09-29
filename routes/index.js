const express = require("express");
const shop = require("../controllers/shopController");

const router = express.Router();

router.get("/", shop.showHome);
router.get("/about", shop.showAbout);
router.get("/shop", shop.showShop);
router.get("/products/:slug", shop.showProduct);

module.exports = router;
