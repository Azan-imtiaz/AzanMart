const orderModel = require("../models/orderModel");
const httpError = require("../utils/httpError");

exports.listOrders = async (req, res) => {
  const orders = await orderModel
    .find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select("orderNumber createdAt status total items.quantity")
    .lean();

  res.render("orders", { title: "My orders", orders });
};

exports.showOrder = async (req, res) => {
  const order = await orderModel.findOne({ orderNumber: req.params.orderNumber }).lean();

  // Shoppers can only see their own orders; admins can see any
  const canView = order && (order.user.equals(req.user._id) || req.user.role === "admin");
  if (!canView) throw httpError(404, "We couldn't find that order.");

  res.render("order", { title: `Order ${order.orderNumber}`, order });
};
