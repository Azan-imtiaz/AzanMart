const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const nodemailer = require("nodemailer");
const gmailApi = require("./gmailApi");

const { SMTP_HOST, SMTP_USER } = process.env;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
// Gmail shows App Passwords in groups of four ("abcd efgh ...")
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

// Gmail replaces the sender with the logged-in account anyway, so default to it
const FROM =
  process.env.MAIL_FROM ||
  (SMTP_USER ? `AzanMart <${SMTP_USER}>` : "AzanMart <no-reply@azanmart.dev>");

// How email goes out, in order of preference:
// - "gmail-api": the Gmail API over HTTPS, for hosts that block SMTP (Render's free plan)
// - "smtp": any SMTP server, such as Gmail with an App Password
// - "preview": nothing is sent; emails are saved to temp files, which keeps
//   development and tests working without a mail account
const method = gmailApi.enabled ? "gmail-api" : SMTP_HOST && SMTP_USER ? "smtp" : "preview";

const transports = {
  "gmail-api": () => gmailApi.transport,
  smtp: () =>
    nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Fail fast instead of hanging when a host blocks SMTP ports
      connectionTimeout: 15_000,
    }),
  preview: () => nodemailer.createTransport({ jsonTransport: true }),
};
const transport = transports[method]();

// A failed email should never break checkout, so errors are logged, not thrown
async function sendMail({ to, subject, html }) {
  try {
    await transport.sendMail({ from: FROM, to, subject, html });
    if (method === "preview" && process.env.NODE_ENV !== "test") {
      // Save a copy so links and codes can be opened during development
      const file = path.join(os.tmpdir(), `azanmart-mail-${Date.now()}.html`);
      await fs.writeFile(file, html);
      console.log(`[mail] ${subject} -> ${to} (preview: ${file})`);
    }
  } catch (err) {
    console.error(`Could not send "${subject}" to ${to}:`, err.message);
  }
}

// Checks the mail settings at startup so a mistake shows up in the logs
// straight away, not when the first customer places an order
async function checkMailer() {
  if (method === "preview") {
    console.log("Email: no mail settings, emails are saved to temp files instead of sent");
    return;
  }
  try {
    await transport.verify();
    console.log(
      method === "gmail-api"
        ? "Email: sending through the Gmail API"
        : `Email: sending through ${SMTP_HOST} as ${SMTP_USER}`,
    );
  } catch (err) {
    if (method === "gmail-api") {
      console.error(`Email: could not connect to the Gmail API: ${err.message}`);
      return;
    }
    console.error(`Email: could not log in to ${SMTP_HOST}: ${err.message}`);
    if (SMTP_HOST.includes("gmail") && err.code === "EAUTH") {
      console.error(
        "Email: Gmail needs an App Password, not your normal password. See docs/DEPLOYMENT.md.",
      );
    } else if (["ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(err.code)) {
      console.error(
        "Email: the SMTP server can't be reached. Some hosts (like Render's free plan) block SMTP; use the Gmail API instead. See docs/DEPLOYMENT.md.",
      );
    }
  }
}

module.exports = { sendMail, checkMailer, emailEnabled: method !== "preview" };
