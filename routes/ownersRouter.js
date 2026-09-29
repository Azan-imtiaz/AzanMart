const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const { isOwner } = require("../middlewares/isOwner");
const owner = require("../controllers/ownerController");

const router = express.Router();

const loginRules = [
  body("email").trim().toLowerCase().isEmail().withMessage("Please enter a valid email"),
  body("password").notEmpty().withMessage("Please enter your password"),
];

if (process.env.NODE_ENV === "development") {
  router.post("/create", owner.createOwner);
}

router.get("/login", owner.showLogin);
router.post("/login", validate(loginRules, "/owners/login"), owner.login);
router.get("/logout", owner.logout);
router.get("/admin", isOwner, owner.showAdmin);

module.exports = router;
