const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const upload = require("../config/multer-config");
const { isOwner } = require("../middlewares/isOwner");
const { createProduct } = require("../controllers/productController");

const router = express.Router();

// Wrap multer so upload errors (size / file type) show up as a flash message
const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/owners/admin");
    }
    next();
  });
};

const hexColor = (field) =>
  body(field)
    .optional({ values: "falsy" })
    .trim()
    .isHexColor()
    .withMessage("Colors must be hex values like #f5e6c8");

// Runs after multer, because multipart fields are only parsed there
const productRules = [
  body("name").trim().notEmpty().withMessage("Product name is required").isLength({ max: 100 }),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("discount")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 })
    .withMessage("Discount must be a positive number"),
  hexColor("bgcolor"),
  hexColor("panelcolor"),
  hexColor("textcolor"),
];

router.post(
  "/create",
  isOwner,
  uploadImage,
  validate(productRules, "/owners/admin"),
  createProduct,
);

module.exports = router;
