const orderModel = require("../models/orderModel");
const cryptoConfig = require("../config/crypto");
const httpError = require("../utils/httpError");
const { verifyPayment, formatUsdc, isTxHash } = require("../services/crypto");
const { markOrderPaid } = require("../services/orders");

async function findOwnOrder(req) {
  const order = await orderModel.findOne({ orderNumber: req.params.orderNumber });
  if (!order || !order.user.equals(req.user._id) || order.paymentMethod !== "crypto") {
    throw httpError(404, "We couldn't find that order.");
  }
  return order;
}

// Checks a transaction and marks the order paid if it matches.
// Returns { status: "paid" | "pending" | "failed", message }.
async function confirmPayment(order, txHash) {
  if (order.paymentStatus === "paid")
    return { status: "paid", message: "This order is already paid." };
  if (order.status === "cancelled") {
    return {
      status: "failed",
      message:
        "This order's payment window has closed. If you already paid, contact us with your transaction hash.",
    };
  }

  const result = await verifyPayment(order, txHash);
  if (result.status !== "paid") return result;

  try {
    const paid = await markOrderPaid(order._id, {
      "crypto.txHash": txHash.toLowerCase(),
      "crypto.payer": result.payer,
    });
    if (!paid) return { status: "failed", message: "This order can no longer be paid." };
  } catch (err) {
    // The unique index on the hash: this transaction already paid another order
    if (err.code === 11000) {
      return {
        status: "failed",
        message: "This transaction has already been used to pay another order.",
      };
    }
    throw err;
  }
  return { status: "paid", message: "Payment confirmed. Thank you for your order!" };
}

exports.showPaymentPage = async (req, res) => {
  const order = await findOwnOrder(req);
  if (order.status !== "pending") return res.redirect(`/orders/${order.orderNumber}`);

  res.render("pay-crypto", {
    title: `Pay for order ${order.orderNumber}`,
    order,
    amount: formatUsdc(order.crypto.amount),
    network: {
      name: cryptoConfig.networkName,
      chainId: cryptoConfig.chainId,
      rpcUrl: cryptoConfig.publicRpcUrl,
      explorerUrl: cryptoConfig.explorerUrl,
      token: cryptoConfig.token,
      receiver: cryptoConfig.receiver,
      isTestnet: cryptoConfig.isTestnet,
    },
  });
};

// Called by the payment page while it waits for the blockchain (JSON), or by
// the "paste your transaction hash" form (regular POST)
exports.confirm = async (req, res) => {
  const order = await findOwnOrder(req);
  const txHash = String(req.body.txHash || "").trim();
  const result = isTxHash(txHash)
    ? await confirmPayment(order, txHash)
    : { status: "failed", message: "That doesn't look like a transaction hash." };

  if (req.is("application/json")) return res.json(result);

  if (result.status === "paid") {
    req.flash("success", result.message);
    return res.redirect(`/orders/${order.orderNumber}`);
  }
  req.flash(
    "error",
    result.status === "pending"
      ? "We can't see that transaction confirmed yet. Please try again in a minute."
      : result.message,
  );
  res.redirect(`/orders/${order.orderNumber}/pay`);
};
