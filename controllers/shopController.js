const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const httpError = require("../utils/httpError");

exports.showHome = (req, res) => {
  res.render("index", { title: "Sign in" });
};

exports.showAbout = (req, res) => {
  res.render("about", {
    title: "About the developer",
    description:
      "AzanMart is designed and developed by Azan Imtiaz, a Software Engineering graduate and MERN & Blockchain developer.",
  });
};

exports.showShop = async (req, res) => {
  const products = await productModel.find({}).select("-images.data").lean();
  res.render("shop", { title: "Shop", products });
};

exports.addToCart = async (req, res) => {
  const { productid } = req.params;
  if (!mongoose.isValidObjectId(productid) || !(await productModel.exists({ _id: productid }))) {
    throw httpError(404, "Product not found");
  }

  await userModel.updateOne({ _id: req.user._id }, { $push: { cart: productid } });
  req.flash("success", "Added to cart");
  res.redirect("/shop");
};

exports.showCart = async (req, res) => {
  const user = await userModel
    .findById(req.user._id)
    .populate({ path: "cart", select: "-images.data" });
  // Drop items whose product has been deleted
  user.cart = user.cart.filter(Boolean);
  res.render("cart", { title: "Your cart", user });
};
