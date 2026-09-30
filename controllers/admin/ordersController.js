const orderModel = require("../../models/orderModel");
const httpError = require("../../utils/httpError");
const { updateOrderStatus } = require("../../services/orders");

const PAGE_SIZE = 20;

async function findOrder(orderNumber) {
  const order = await orderModel.findOne({ orderNumber }).populate("user", "fullName email");
  if (!order) throw httpError(404, "Order not found");
  return order;
}

exports.listOrders = async (req, res) => {
  const status = orderModel.STATUSES.includes(req.query.status) ? req.query.status : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim().toUpperCase() : "";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const filter = {};
  if (status) filter.status = status;
  if (q) filter.orderNumber = q.startsWith("AZM-") ? q : `AZM-${q}`;

  const [orders, total] = await Promise.all([
    orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .select(
        "orderNumber createdAt status paymentMethod paymentStatus total shippingAddress.fullName",
      )
      .lean(),
    orderModel.countDocuments(filter),
  ]);

  res.render("admin/orders", {
    title: "Orders",
    orders,
    status,
    q,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    statuses: orderModel.STATUSES,
  });
};

exports.showOrder = async (req, res) => {
  const order = await findOrder(req.params.orderNumber);
  res.render("admin/order", {
    title: `Order ${order.orderNumber}`,
    order,
    statuses: orderModel.STATUSES,
  });
};

exports.updateStatus = async (req, res) => {
  const order = await findOrder(req.params.orderNumber);
  const error = await updateOrderStatus(order, req.body.status);

  if (error) req.flash("error", error);
  else req.flash("success", `Order ${order.orderNumber} is now ${order.status}`);
  res.redirect(`/admin/orders/${order.orderNumber}`);
};
