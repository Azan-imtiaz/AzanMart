const express = require("express");
const { body } = require("express-validator");
const upload = require("../config/multer-config");
const validate = require("../middlewares/validate");
const { isLoggedIn } = require("../middlewares/isLoggedIn");
const requireAdmin = require("../middlewares/requireAdmin");
const admin = require("../controllers/adminController");

const router = express.Router();

// Every admin route needs a logged-in admin
router.use(isLoggedIn, requireAdmin);

// Wrap multer so upload errors (size / file type) show up as a flash message
const uploadImage = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/admin");
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

router.get("/", admin.showNewProduct);
router.post("/products", uploadImage, validate(productRules, "/admin"), admin.createProduct);

module.exports = router;
