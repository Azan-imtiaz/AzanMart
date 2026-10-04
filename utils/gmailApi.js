// Sends email through the Gmail API over HTTPS. Hosts like Render's free plan
// block SMTP ports, but not HTTPS, so this still sends from your Gmail account.
// Needs an OAuth client and a refresh token with the gmail.send scope (see docs/DEPLOYMENT.md).
const nodemailer = require("nodemailer");

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
const enabled = Boolean(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);

// Builds the finished email (headers, encoding) without sending it anywhere
const composer = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
  newline: "windows",
});

// Access tokens last about an hour; reuse one until shortly before it expires
let token = null;
async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Google sign-in failed: ${body.error_description || body.error}`);
  }
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function send(message) {
  const { message: raw } = await composer.sendMail(message);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: raw.toString("base64url") }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Gmail API error ${res.status}: ${body.error?.message || res.statusText}`);
  }
}

// Same shape as a nodemailer transport, so the mailer can use either
const transport = {
  sendMail: send,
  // Getting an access token proves the client id, secret and refresh token are valid
  verify: accessToken,
};

module.exports = { enabled, transport, resetToken: () => (token = null) };
