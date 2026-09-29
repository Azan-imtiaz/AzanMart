const express = require("express");
const { body } = require("express-validator");
const upload = require("../config/multer-config");
const validate = require("../middlewares/validate");
const { requireAdmin } = require("../middlewares/auth");
const productModel = require("../models/productModel");
const dashboard = require("../controllers/admin/dashboardController");
const products = require("../controllers/admin/productsController");

const router = express.Router();

// Every admin route needs a logged-in admin
router.use(requireAdmin);

// Where to send the admin back to when a product form has a problem
const productFormUrl = (req) =>
  req.params.id ? `/admin/products/${req.params.id}/edit` : "/admin/products/new";

const UPLOAD_ERRORS = {
  LIMIT_FILE_SIZE: "Each image must be 2MB or smaller",
  LIMIT_FILE_COUNT: "You can upload up to 4 images",
  LIMIT_UNEXPECTED_FILE: "You can upload up to 4 images",
};

// Wrap multer so upload errors show up as a flash message instead of a 500
const uploadImages = (req, res, next) => {
  upload.array("images", 4)(req, res, (err) => {
    if (err) {
      req.flash("error", UPLOAD_ERRORS[err.code] || err.message);
      return res.redirect(productFormUrl(req));
    }
    next();
  });
};

// Runs after multer, because multipart fields are only parsed there
const productRules = [
  body("name").trim().notEmpty().withMessage("Product name is required").isLength({ max: 100 }),
  body("description").optional().trim().isLength({ max: 2000 }),
  body("category").isIn(productModel.CATEGORIES).withMessage("Pick a valid category"),
  body("price").isFloat({ min: 0.5 }).withMessage("Price must be at least $0.50"),
  body("discount")
    .optional({ values: "falsy" })
    .isInt({ min: 0, max: 90 })
    .withMessage("Discount must be between 0 and 90 percent"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be 0 or more"),
  body("bgcolor")
    .optional({ values: "falsy" })
    .isHexColor()
    .withMessage("Background must be a hex colour"),
];

router.get("/", dashboard.showDashboard);

router.get("/products", products.listProducts);
router.get("/products/new", products.showNewForm);
router.post(
  "/products",
  uploadImages,
  validate(productRules, productFormUrl),
  products.createProduct,
);
router.get("/products/:id/edit", products.showEditForm);
router.post(
  "/products/:id",
  uploadImages,
  validate(productRules, productFormUrl),
  products.updateProduct,
);
router.post("/products/:id/delete", products.deleteProduct);

module.exports = router;
