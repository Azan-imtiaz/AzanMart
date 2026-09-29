const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { authLimiter } = require("../middlewares/rateLimit");
const auth = require("../controllers/authController");

const router = express.Router();

const registerRules = [
  body("fullname").trim().notEmpty().withMessage("Please enter your name").isLength({ max: 60 }),
  body("email").trim().toLowerCase().isEmail().withMessage("Please enter a valid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

const loginRules = [
  body("email").trim().toLowerCase().isEmail().withMessage("Please enter a valid email"),
  body("password").notEmpty().withMessage("Please enter your password"),
];

router.post("/register", authLimiter, validate(registerRules, "/"), auth.register);
router.post("/login", authLimiter, validate(loginRules, "/"), auth.login);
router.post("/logout", auth.logout);

module.exports = router;
