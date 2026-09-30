const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { authLimiter } = require("../middlewares/rateLimit");
const auth = require("../controllers/authController");
const passwordReset = require("../controllers/passwordResetController");
const verification = require("../controllers/verificationController");
const { requireAuth } = require("../middlewares/auth");

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

router.get("/login", auth.showLogin);
router.post("/login", authLimiter, validate(loginRules, "/login"), auth.login);
router.get("/register", auth.showRegister);
router.post("/register", authLimiter, validate(registerRules, "/register"), auth.register);
router.post("/logout", auth.logout);

const emailRules = [
  body("email").trim().toLowerCase().isEmail().withMessage("Please enter a valid email"),
];
const newPasswordRules = [
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("The passwords don't match"),
];

const codeRules = [
  body("code")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("Enter the 6-digit code from the email"),
];

router.get("/verify-email", requireAuth, verification.showForm);
router.post(
  "/verify-email",
  requireAuth,
  authLimiter,
  validate(codeRules, "/verify-email"),
  verification.verify,
);
router.post("/verify-email/resend", requireAuth, verification.resend);

router.get("/forgot-password", passwordReset.showForgotForm);
router.post(
  "/forgot-password",
  authLimiter,
  validate(emailRules, "/forgot-password"),
  passwordReset.sendResetLink,
);
router.get("/reset-password/:token", passwordReset.showResetForm);
router.post(
  "/reset-password/:token",
  authLimiter,
  validate(newPasswordRules, (req) => `/reset-password/${req.params.token}`),
  passwordReset.resetPassword,
);

module.exports = router;
