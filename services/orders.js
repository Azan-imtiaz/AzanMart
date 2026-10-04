const crypto = require("crypto");
const mongoose = require("mongoose");
const orderModel = require("../models/orderModel");
const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
const { sendOrderConfirmation, sendOrderUpdate } = require("./emails");

// Takes stock for every item, one atomic update each. The update only matches
// when enough stock is left, so two shoppers can't both buy the last unit.
// If any item fails, stock already taken is put back.
async function reserveStock(items) {
  const reserved = [];
  for (const { product, quantity } of items) {
    const result = await productModel.updateOne(
      { _id: product._id, stock: mongoose.trusted({ $gte: quantity }) },
      { $inc: { stock: -quantity } },
    );
    if (result.modifiedCount === 0) {
      await releaseStock(reserved);
      return { ok: false, productName: product.name };
    }
    reserved.push({ product: product._id, quantity });
  }
  return { ok: true };
}

async function releaseStock(items) {
  for (const { product, quantity } of items) {
    await productModel.updateOne({ _id: product._id ?? product }, { $inc: { stock: quantity } });
  }
}

function newOrderNumber() {
  return `AZM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

// Turns the current cart into an order. Returns { order } or { error }.
async function placeOrder({ user, cart, shippingAddress, paymentMethod, crypto }) {
  const reservation = await reserveStock(cart.items);
  if (!reservation.ok) {
    return { error: `Sorry, ${reservation.productName} just sold out. Please update your cart.` };
  }

  const order = await orderModel.create({
    orderNumber: newOrderNumber(),
    user: user._id,
    items: cart.items.map(({ product, quantity }) => ({
      product: product._id,
      name: product.name,
      slug: product.slug,
      imageUrl: `/product-images/${product._id}/${product.images[0]._id}`,
      price: product.finalPrice,
      quantity,
    })),
    subtotal: cart.subtotal,
    shipping: cart.shipping,
    total: cart.total,
    shippingAddress,
    paymentMethod,
    crypto,
    status: paymentMethod === "cod" ? "processing" : "pending",
  });

  return { order };
}

async function clearCart(userId) {
  await userModel.updateOne({ _id: userId }, { $set: { cart: [] } });
}

// Safe to call more than once (redirect and webhook can both confirm the same
// payment): only the call that flips the order from unpaid does any work.
// `details` is saved in the same update, e.g. the transaction that paid a crypto order.
async function markOrderPaid(orderId, details = {}) {
  const order = await orderModel.findOneAndUpdate(
    { _id: orderId, paymentStatus: "unpaid", status: "pending" },
    { ...details, paymentStatus: "paid", status: "processing", paidAt: new Date() },
    { new: true },
  );
  if (order) {
    await clearCart(order.user);
    await sendOrderConfirmation(order);
  }
  return order;
}

// Cancels an unpaid order and puts its stock back. Also only acts once.
async function cancelOrder(orderId) {
  const order = await orderModel.findOneAndUpdate(
    { _id: orderId, status: "pending", paymentStatus: "unpaid" },
    { status: "cancelled", cancelledAt: new Date() },
    { new: true },
  );
  if (order) await releaseStock(order.items);
  return order;
}

// Crypto orders hold stock while the shopper pays; give it back once the
// payment window has passed. The grace period lets a payment sent in the last
// seconds still confirm. Called on a timer from server.js.
const CRYPTO_GRACE_MS = 5 * 60 * 1000;

async function cancelExpiredCryptoOrders() {
  const expired = await orderModel
    .find({
      paymentMethod: "crypto",
      status: "pending",
      "crypto.expiresAt": mongoose.trusted({ $lt: new Date(Date.now() - CRYPTO_GRACE_MS) }),
    })
    .select("_id");
  for (const order of expired) await cancelOrder(order._id);
  return expired.length;
}

const FINAL_STATUSES = ["delivered", "cancelled"];

// Admin status changes. `shipment` holds the courier and tracking number when
// an order is marked as shipped. Returns an error message, or null on success.
async function updateOrderStatus(order, status, shipment = {}) {
  if (order.status === status) return null;
  if (FINAL_STATUSES.includes(order.status)) {
    return `This order is already ${order.status} and can't be changed.`;
  }

  const now = new Date();
  if (status === "shipped") {
    order.shipment = {
      carrier: shipment.carrier || undefined,
      trackingNumber: shipment.trackingNumber || undefined,
      shippedAt: now,
    };
  }
  if (status === "delivered") order.set("shipment.deliveredAt", now);
  if (status === "cancelled") {
    order.cancelledAt = now;
    await releaseStock(order.items);
  }
  // Cash on delivery is collected when the parcel arrives
  if (status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "unpaid") {
    order.paymentStatus = "paid";
    order.paidAt = now;
  }

  order.status = status;
  await order.save();

  await sendOrderUpdate(order);
  return null;
}

module.exports = {
  placeOrder,
  releaseStock,
  clearCart,
  markOrderPaid,
  cancelOrder,
  updateOrderStatus,
  cancelExpiredCryptoOrders,
  FINAL_STATUSES,
};
