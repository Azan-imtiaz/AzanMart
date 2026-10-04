const path = require("path");
const ejs = require("ejs");
const userModel = require("../models/userModel");
const { sendMail } = require("../utils/mailer");
const { formatPrice } = require("../utils/money");
const { APP_URL } = require("../config/site");
const cryptoConfig = require("../config/crypto");

function render(template, data) {
  const file = path.join(__dirname, "../views/emails", `${template}.ejs`);
  const txUrl = (hash) => `${cryptoConfig.explorerUrl}/tx/${hash}`;
  return ejs.renderFile(file, { ...data, formatPrice, txUrl, appUrl: APP_URL });
}

async function sendOrderConfirmation(order) {
  const user = await userModel.findById(order.user).select("email fullName").lean();
  if (!user) return;

  await sendMail({
    to: user.email,
    subject: `Your AzanMart order ${order.orderNumber}`,
    html: await render("order-confirmation", { order, user }),
  });
}

const STATUS_EMAILS = {
  shipped: (order) => `Your AzanMart order ${order.orderNumber} is on its way`,
  delivered: (order) => `Your AzanMart order ${order.orderNumber} was delivered`,
  cancelled: (order) => `Your AzanMart order ${order.orderNumber} was cancelled`,
};

// Emails the customer when an admin ships, delivers or cancels their order
async function sendOrderUpdate(order) {
  const subject = STATUS_EMAILS[order.status];
  if (!subject) return;

  const user = await userModel.findById(order.user).select("email fullName").lean();
  if (!user) return;

  await sendMail({
    to: user.email,
    subject: subject(order),
    html: await render(`order-${order.status}`, { order, user }),
  });
}

async function sendPasswordReset(user, resetUrl) {
  await sendMail({
    to: user.email,
    subject: "Reset your AzanMart password",
    html: await render("password-reset", { user, resetUrl }),
  });
}

async function sendVerificationCode(user, code) {
  await sendMail({
    to: user.email,
    subject: `${code} is your AzanMart verification code`,
    html: await render("verify-email", { user, code }),
  });
}

module.exports = {
  render,
  sendOrderConfirmation,
  sendOrderUpdate,
  sendPasswordReset,
  sendVerificationCode,
};
