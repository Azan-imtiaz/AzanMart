const orderModel = require("../models/orderModel");
const httpError = require("../utils/httpError");

exports.showOrder = async (req, res) => {
  const order = await orderModel.findOne({ orderNumber: req.params.orderNumber }).lean();

  // Shoppers can only see their own orders; admins can see any
  const canView = order && (order.user.equals(req.user._id) || req.user.role === "admin");
  if (!canView) throw httpError(404, "We couldn't find that order.");

  res.render("order", { title: `Order ${order.orderNumber}`, order });
};
