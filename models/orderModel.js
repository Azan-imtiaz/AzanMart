const mongoose = require("mongoose");

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

// Name and price are copied from the product so the order never changes
// if the product is later edited or deleted
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    name: { type: String, required: true },
    slug: String,
    imageUrl: String,
    price: { type: Number, required: true }, // cents, per unit
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    total: { type: Number, required: true },
    shippingAddress: { type: addressSchema, required: true },
    paymentMethod: { type: String, enum: ["card", "cod"], required: true },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    status: { type: String, enum: STATUSES, default: "pending" },
    stripeSessionId: String,
    paidAt: Date,
    shipment: {
      carrier: String,
      trackingNumber: String,
      shippedAt: Date,
      deliveredAt: Date,
    },
    cancelledAt: Date,
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 }); // a shopper's order history
orderSchema.index({ status: 1, createdAt: -1 }); // admin list filtered by status
orderSchema.index({ paymentStatus: 1, paidAt: 1 }); // dashboard revenue chart

module.exports = mongoose.model("order", orderSchema);
module.exports.STATUSES = STATUSES;
