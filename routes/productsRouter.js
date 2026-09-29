const express = require("express");
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

router.post("/create", isOwner, uploadImage, createProduct);

module.exports = router;
