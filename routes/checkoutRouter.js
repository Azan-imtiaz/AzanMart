const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { requireAuth, requireVerifiedEmail } = require("../middlewares/auth");
const checkout = require("../controllers/checkoutController");

const router = express.Router();

const required = (field, label, max = 100) =>
  body(field).trim().notEmpty().withMessage(`${label} is required`).isLength({ max });

const addressRules = [
  required("fullName", "Full name", 60),
  required("phone", "Phone number", 30),
  required("line1", "Address", 120),
  body("line2").optional().trim().isLength({ max: 120 }),
  required("city", "City", 60),
  required("postalCode", "Postal code", 20),
  required("country", "Country", 60),
  body("paymentMethod").isIn(["cod", "card"]).withMessage("Choose a payment method"),
];

router.use(requireAuth, requireVerifiedEmail);

router.get("/", checkout.showCheckout);
router.post("/", validate(addressRules, "/checkout"), checkout.placeOrder);

module.exports = router;
