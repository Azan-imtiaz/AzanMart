const nodemailer = require("nodemailer");

const FROM = process.env.MAIL_FROM || "AzanMart <no-reply@azanmart.dev>";

// Without SMTP settings, emails are logged instead of sent, which keeps
// development and tests working without a mail account
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });

// A failed email should never break checkout, so errors are logged, not thrown
async function sendMail({ to, subject, html }) {
  try {
    await transport.sendMail({ from: FROM, to, subject, html });
    if (!process.env.SMTP_HOST && process.env.NODE_ENV !== "test") {
      console.log(`[mail] ${subject} -> ${to}`);
    }
  } catch (err) {
    console.error(`Could not send "${subject}" to ${to}:`, err.message);
  }
}

module.exports = { sendMail };
