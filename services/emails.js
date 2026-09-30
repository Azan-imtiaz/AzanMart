const path = require("path");
const ejs = require("ejs");
const userModel = require("../models/userModel");
const { sendMail } = require("../utils/mailer");
const { formatPrice } = require("../utils/money");
const { APP_URL } = require("../config/site");

function render(template, data) {
  const file = path.join(__dirname, "../views/emails", `${template}.ejs`);
  return ejs.renderFile(file, { ...data, formatPrice, appUrl: APP_URL });
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

async function sendOrderShipped(order) {
  const user = await userModel.findById(order.user).select("email fullName").lean();
  if (!user) return;

  await sendMail({
    to: user.email,
    subject: `Your AzanMart order ${order.orderNumber} is on its way`,
    html: await render("order-shipped", { order, user }),
  });
}

module.exports = { render, sendOrderConfirmation, sendOrderShipped };
