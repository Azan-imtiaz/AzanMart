const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { requireAuth } = require("../middlewares/auth");
const shop = require("../controllers/shopController");
const reviews = require("../controllers/reviewController");

const router = express.Router();

router.get("/", shop.showHome);
router.get("/about", shop.showAbout);
router.get("/features", shop.showFeatures);
router.get("/shop", shop.showShop);
router.get("/products/:slug", shop.showProduct);

const reviewRules = [
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Pick a rating from 1 to 5 stars").toInt(),
  body("comment")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Keep reviews under 1000 characters"),
];

router.post(
  "/products/:slug/reviews",
  requireAuth,
  validate(reviewRules, (req) => `/products/${req.params.slug}#reviews`),
  reviews.saveReview,
);
router.post("/products/:slug/reviews/delete", requireAuth, reviews.deleteReview);

module.exports = router;
