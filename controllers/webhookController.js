const mongoose = require("mongoose");
const { stripe } = require("../utils/stripe");
const { markOrderPaid, cancelOrder } = require("../services/orders");

exports.handleStripeEvent = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(404).end();

  // The signature proves the request really came from Stripe
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get("stripe-signature"), secret);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  const session = event.data.object;
  const orderId = session.metadata?.orderId;

  if (mongoose.isValidObjectId(orderId)) {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (session.payment_status === "paid") await markOrderPaid(orderId);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await cancelOrder(orderId);
        break;
    }
  }

  // Stripe retries until it gets a 2xx, so acknowledge everything we could read
  res.json({ received: true });
};
