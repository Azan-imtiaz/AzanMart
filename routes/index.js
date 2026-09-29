const express = require("express");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const { isLoggedIn } = require("../middlewares/isLoggedIn");

const router = express.Router();

router.get("/", function (req, res) {
    const error = req.flash("error");
    const success = req.flash("success");

    res.render("index", {
        title: "Sign in",
        error: error.length ? error : null,
        successMessage: success.length ? success : null,
        loggedIn: false
    });
});

router.get("/shop", isLoggedIn, async (req, res) => {
    try {
        const message = req.flash("successMessage");
        const products = await productModel.find({}).lean();
        res.render("shop", { title: "Shop", products, successMessage: message });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/addToCart/:productid", isLoggedIn, async (req, res) => {
    try {
        const { productid } = req.params;
        if (!mongoose.isValidObjectId(productid) || !(await productModel.exists({ _id: productid }))) {
            return res.status(404).send("Product not found");
        }

        await userModel.updateOne({ _id: req.user._id }, { $push: { cart: productid } });
        req.flash("successMessage", "Added to cart");
        res.redirect("/shop");
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/cart", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findById(req.user._id).populate("cart");
        // Drop items whose product has been deleted
        user.cart = user.cart.filter(Boolean);
        res.render("cart", { title: "Your cart", user });
    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
