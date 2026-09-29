const express = require("express");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const { isLoggedIn } = require("../middlewares/isLoggedIn");
const httpError = require("../utils/httpError");

const router = express.Router();

router.get("/", function (req, res) {
  res.render("index", { title: "Sign in", loggedIn: false });
});

router.get("/about", (req, res) => {
  res.render("about", {
    title: "About the developer",
    description:
      "AzanMart is designed and developed by Azan Imtiaz, a Software Engineering graduate and MERN & Blockchain developer.",
    loggedIn: Boolean(req.cookies.token),
  });
});

router.get("/shop", isLoggedIn, async (req, res) => {
  const products = await productModel.find({}).lean();
  res.render("shop", { title: "Shop", products });
});

router.post("/addToCart/:productid", isLoggedIn, async (req, res) => {
  const { productid } = req.params;
  if (!mongoose.isValidObjectId(productid) || !(await productModel.exists({ _id: productid }))) {
    throw httpError(404, "Product not found");
  }

  await userModel.updateOne({ _id: req.user._id }, { $push: { cart: productid } });
  req.flash("success", "Added to cart");
  res.redirect("/shop");
});

router.get("/cart", isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.user._id).populate("cart");
  // Drop items whose product has been deleted
  user.cart = user.cart.filter(Boolean);
  res.render("cart", { title: "Your cart", user });
});

module.exports = router;
