const mongoose = require("mongoose");
const orderModel = require("../models/orderModel");
const cryptoConfig = require("../config/crypto");
const { uniquePaymentAmount } = require("../services/crypto");
const { getCart } = require("../services/cart");
const { placeOrder, clearCart, cancelOrder, markOrderPaid } = require("../services/orders");
const { sendOrderConfirmation } = require("../services/emails");
const { stripe } = require("../utils/stripe");
const { CURRENCY } = require("../utils/money");

async function loadCheckoutCart(req, res) {
  const cart = await getCart(req.user._id);
  if (!cart.items.length) {
    res.redirect("/cart");
    return null;
  }
  if (cart.hasStockProblems) {
    req.flash("error", "Some items in your cart are no longer available in that quantity");
    res.redirect("/cart");
    return null;
  }
  return cart;
}

function stripeLineItems(order) {
  const lineItems = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: CURRENCY,
      unit_amount: item.price,
      product_data: { name: item.name },
    },
  }));
  if (order.shipping > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: order.shipping,
        product_data: { name: "Shipping" },
      },
    });
  }
  return lineItems;
}

// A shopper who left a card or crypto payment unfinished still has a pending
// order holding stock. Starting a new checkout cancels it.
async function cancelAbandonedOrders(userId) {
  const pending = await orderModel
    .find({
      user: userId,
      paymentMethod: mongoose.trusted({ $in: ["card", "crypto"] }),
      status: "pending",
    })
    .select("stripeSessionId");
  for (const order of pending) {
    if (order.stripeSessionId) {
      try {
        await stripe.checkout.sessions.expire(order.stripeSessionId);
      } catch {
        // Stripe won't expire a finished session. If the shopper actually paid
        // (say, in another tab), keep the order instead of cancelling it.
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (session.payment_status === "paid") {
          await markOrderPaid(order._id);
          continue;
        }
      }
    }
    await cancelOrder(order._id);
  }
}

exports.showCheckout = async (req, res) => {
  const cart = await loadCheckoutCart(req, res);
  if (!cart) return;

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
    cardPayments: Boolean(stripe),
    // Test card numbers only work with Stripe test keys
    stripeTestMode: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"),
    cryptoPayments: cryptoConfig.enabled,
    cryptoTestnet: cryptoConfig.isTestnet,
    cryptoNetwork: cryptoConfig.networkName,
  });
};

exports.placeOrder = async (req, res) => {
  const available = { card: Boolean(stripe), crypto: cryptoConfig.enabled, cod: true };
  const paymentMethod = available[req.body.paymentMethod] ? req.body.paymentMethod : "cod";
  await cancelAbandonedOrders(req.user._id);

  const cart = await loadCheckoutCart(req, res);
  if (!cart) return;

  const { fullName, phone, line1, line2, city, postalCode, country } = req.body;
  const crypto =
    paymentMethod === "crypto"
      ? {
          amount: await uniquePaymentAmount(cart.total),
          chainId: cryptoConfig.chainId,
          expiresAt: new Date(Date.now() + cryptoConfig.paymentWindowMinutes * 60 * 1000),
        }
      : undefined;

  const { order, error } = await placeOrder({
    user: req.user,
    cart,
    shippingAddress: { fullName, phone, line1, line2, city, postalCode, country },
    paymentMethod,
    crypto,
  });

  if (error) {
    req.flash("error", error);
    return res.redirect("/cart");
  }

  if (paymentMethod === "cod") {
    await clearCart(req.user._id);
    await sendOrderConfirmation(order);
    req.flash("success", "Thank you! Your order has been placed.");
    return res.redirect(`/orders/${order.orderNumber}`);
  }

  // Crypto: the shopper pays from their wallet on the next page
  if (paymentMethod === "crypto") return res.redirect(`/orders/${order.orderNumber}/pay`);

  // Card: the cart is only cleared once Stripe confirms the payment
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: req.user.email,
      client_reference_id: order._id.toString(),
      metadata: { orderId: order._id.toString() },
      line_items: stripeLineItems(order),
      // Unpaid sessions expire after 30 minutes and release the stock (see webhook)
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${res.locals.appUrl}/orders/${order.orderNumber}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${res.locals.appUrl}/cart?checkout=cancelled`,
    });

    order.stripeSessionId = session.id;
    await order.save();
    res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe checkout failed:", err.message);
    await cancelOrder(order._id);
    req.flash(
      "error",
      "We couldn't start the card payment. Please try again or choose cash on delivery.",
    );
    res.redirect("/checkout");
  }
};
