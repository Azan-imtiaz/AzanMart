const orderModel = require("../models/orderModel");
const httpError = require("../utils/httpError");
const { stripe } = require("../utils/stripe");
const { markOrderPaid } = require("../services/orders");

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

  // Coming back from Stripe: confirm the payment straight away instead of
  // waiting for the webhook, so the shopper sees the right status
  if (req.query.session_id && order.paymentStatus === "unpaid" && order.stripeSessionId && stripe) {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.payment_status === "paid") {
      await markOrderPaid(order._id);
      req.flash("success", "Payment received. Thank you for your order!");
      return res.redirect(`/orders/${order.orderNumber}`);
    }
  }

  res.render("order", { title: `Order ${order.orderNumber}`, order });
};
