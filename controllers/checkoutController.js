const orderModel = require("../models/orderModel");
const { getCart } = require("../services/cart");
const { placeOrder, clearCart } = require("../services/orders");

exports.showCheckout = async (req, res) => {
  const cart = await getCart(req.user._id);
  if (!cart.items.length) return res.redirect("/cart");
  if (cart.hasStockProblems) {
    req.flash("error", "Some items in your cart are no longer available in that quantity");
    return res.redirect("/cart");
  }

  // Pre-fill the form with the address from the shopper's last order
  const lastOrder = await orderModel
    .findOne({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select("shippingAddress")
    .lean();

  res.render("checkout", {
    title: "Checkout",
    cart,
    address: lastOrder?.shippingAddress || { fullName: req.user.fullName },
  });
};

exports.placeOrder = async (req, res) => {
  const cart = await getCart(req.user._id);
  if (!cart.items.length) return res.redirect("/cart");
  if (cart.hasStockProblems) {
    req.flash("error", "Some items in your cart are no longer available in that quantity");
    return res.redirect("/cart");
  }

  const { fullName, phone, line1, line2, city, postalCode, country } = req.body;
  const { order, error } = await placeOrder({
    user: req.user,
    cart,
    shippingAddress: { fullName, phone, line1, line2, city, postalCode, country },
    paymentMethod: "cod",
  });

  if (error) {
    req.flash("error", error);
    return res.redirect("/cart");
  }

  await clearCart(req.user._id);
  req.flash("success", "Thank you! Your order has been placed.");
  res.redirect(`/orders/${order.orderNumber}`);
};
