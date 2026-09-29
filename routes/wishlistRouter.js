const express = require("express");
const { requireAuth } = require("../middlewares/auth");
const wishlist = require("../controllers/wishlistController");

const router = express.Router();

router.use(requireAuth);

router.get("/", wishlist.showWishlist);
router.post("/:productId", wishlist.toggleItem);

module.exports = router;
