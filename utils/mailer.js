const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const nodemailer = require("nodemailer");

const { SMTP_HOST, SMTP_USER } = process.env;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
// Gmail shows App Passwords in groups of four ("abcd efgh ...")
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

// Gmail replaces the sender with the logged-in account anyway, so default to it
const FROM =
  process.env.MAIL_FROM ||
  (SMTP_USER ? `AzanMart <${SMTP_USER}>` : "AzanMart <no-reply@azanmart.dev>");

// Without SMTP settings, emails are saved to temp files instead of sent, which
// keeps development and tests working without a mail account
const useSmtp = Boolean(SMTP_HOST && SMTP_USER);
const transport = useSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });

// A failed email should never break checkout, so errors are logged, not thrown
async function sendMail({ to, subject, html }) {
  try {
    await transport.sendMail({ from: FROM, to, subject, html });
    if (!useSmtp && process.env.NODE_ENV !== "test") {
      // Save a copy so links and codes can be opened during development
      const file = path.join(os.tmpdir(), `azanmart-mail-${Date.now()}.html`);
      await fs.writeFile(file, html);
      console.log(`[mail] ${subject} -> ${to} (preview: ${file})`);
    }
  } catch (err) {
    console.error(`Could not send "${subject}" to ${to}:`, err.message);
  }
}

// Logs in to the mail server at startup so a wrong password shows up in the
// logs straight away, not when the first customer places an order
async function checkMailer() {
  if (!useSmtp) {
    console.log("Email: no SMTP settings, emails are saved to temp files instead of sent");
    return;
  }
  try {
    await transport.verify();
    console.log(`Email: sending through ${SMTP_HOST} as ${SMTP_USER}`);
  } catch (err) {
    console.error(`Email: could not log in to ${SMTP_HOST}: ${err.message}`);
    if (SMTP_HOST.includes("gmail") && err.code === "EAUTH") {
      console.error(
        "Email: Gmail needs an App Password, not your normal password. See docs/DEPLOYMENT.md.",
      );
    }
  }
}

module.exports = { sendMail, checkMailer, emailEnabled: useSmtp };
