const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { requireAuth } = require("../middlewares/auth");
const account = require("../controllers/accountController");

const router = express.Router();

const profileRules = [
  body("fullname").trim().notEmpty().withMessage("Please enter your name").isLength({ max: 60 }),
  body("email").trim().toLowerCase().isEmail().withMessage("Please enter a valid email"),
];

const passwordRules = [
  body("currentPassword").notEmpty().withMessage("Enter your current password"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters"),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("The new passwords don't match"),
];

router.use(requireAuth);

router.get("/", account.showAccount);
router.post("/profile", validate(profileRules, "/account"), account.updateProfile);
router.post("/password", validate(passwordRules, "/account"), account.changePassword);

module.exports = router;
