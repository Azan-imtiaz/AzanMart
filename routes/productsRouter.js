const express = require("express");
const upload = require("../config/multer-config");
const productModel = require("../models/productModel");
const { isOwner } = require("../middlewares/isOwner");

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

router.post("/create", isOwner, uploadImage, async (req, res) => {
    try {
        if (!req.file) {
            req.flash("error", "Product image is required");
            return res.redirect("/owners/admin");
        }

        const { name, price, discount, bgcolor, panelcolor, textcolor } = req.body;
        await productModel.create({
            image: req.file.buffer,
            name,
            price,
            discount: discount || 0,
            bgcolor,
            panelcolor,
            textcolor
        });

        req.flash("success", "Product created successfully");
        res.redirect("/owners/admin");
    } catch (err) {
        console.error(err.message);
        req.flash("error", "Could not create product, check the details and try again");
        res.redirect("/owners/admin");
    }
});

module.exports = router;
