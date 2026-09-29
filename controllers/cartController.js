const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const httpError = require("../utils/httpError");
const safeRedirect = require("../utils/safeRedirect");
const { getCart, FREE_SHIPPING_FROM } = require("../services/cart");

async function findProduct(productId) {
  if (!mongoose.isValidObjectId(productId)) throw httpError(404, "Product not found");
  const product = await productModel.findById(productId).select("name stock").lean();
  if (!product) throw httpError(404, "Product not found");
  return product;
}

exports.showCart = async (req, res) => {
  const cart = await getCart(req.user._id);
  res.render("cart", { title: "Your cart", cart, freeShippingFrom: FREE_SHIPPING_FROM });
};

exports.addItem = async (req, res) => {
  const product = await findProduct(req.params.productId);
  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const back = safeRedirect(req.body.returnTo, "/cart");

  const user = await userModel.findById(req.user._id).select("cart");
  const existing = user.cart.find((item) => item.product.equals(product._id));
  const wanted = (existing?.quantity || 0) + quantity;

  if (product.stock === 0) {
    req.flash("error", `${product.name} is out of stock`);
    return res.redirect(back);
  }
  if (wanted > product.stock) {
    req.flash("error", `Only ${product.stock} of ${product.name} available`);
    return res.redirect(back);
  }

  if (existing) existing.quantity = wanted;
  else user.cart.push({ product: product._id, quantity });
  await user.save();

  req.flash("success", `${product.name} added to your cart`);
  res.redirect(back);
};

exports.updateItem = async (req, res) => {
  const product = await findProduct(req.params.productId);
  const quantity = parseInt(req.body.quantity, 10);

  if (!(quantity >= 1)) {
    req.flash("error", "Quantity must be at least 1");
    return res.redirect("/cart");
  }
  if (quantity > product.stock) {
    req.flash("error", `Only ${product.stock} of ${product.name} available`);
    return res.redirect("/cart");
  }

  await userModel.updateOne(
    { _id: req.user._id, "cart.product": product._id },
    { $set: { "cart.$.quantity": quantity } },
  );
  res.redirect("/cart");
};

exports.removeItem = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) throw httpError(404, "Product not found");

  await userModel.updateOne(
    { _id: req.user._id },
    { $pull: { cart: { product: req.params.productId } } },
  );
  req.flash("success", "Item removed from your cart");
  res.redirect("/cart");
};
