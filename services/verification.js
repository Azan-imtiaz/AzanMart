const crypto = require("crypto");
const { sendVerificationCode } = require("./emails");

const CODE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_AFTER = 60 * 1000; // 1 minute

// A 6-digit code has only a million values, so a plain hash could be reversed
// by trying them all. Keying it with the server secret prevents that.
function hashCode(user, code) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(`${user._id}:${code}`)
    .digest("hex");
}

function hasActiveCode(user) {
  return Boolean(user.emailCodeHash && user.emailCodeExpires > Date.now());
}

// Emails a new code. Returns an error message if the last one was sent too recently.
async function sendCode(user) {
  const waitMs = user.emailCodeSentAt ? RESEND_AFTER - (Date.now() - user.emailCodeSentAt) : 0;
  if (waitMs > 0) {
    return `Please wait ${Math.ceil(waitMs / 1000)} seconds before asking for another code.`;
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  user.emailCodeHash = hashCode(user, code);
  user.emailCodeExpires = new Date(Date.now() + CODE_TTL);
  user.emailCodeAttempts = 0;
  user.emailCodeSentAt = new Date();
  await user.save();

  await sendVerificationCode(user, code);
  return null;
}

// Checks a submitted code. Returns an error message, or null once verified.
async function verifyCode(user, code) {
  if (!hasActiveCode(user)) return "That code has expired. We've sent you a new one.";
  if (user.emailCodeAttempts >= MAX_ATTEMPTS) {
    return "Too many wrong codes. Please ask for a new one.";
  }

  const expected = Buffer.from(user.emailCodeHash);
  const actual = Buffer.from(hashCode(user, String(code)));
  if (!crypto.timingSafeEqual(expected, actual)) {
    user.emailCodeAttempts += 1;
    await user.save();
    const left = MAX_ATTEMPTS - user.emailCodeAttempts;
    return left > 0
      ? `That code isn't right. You have ${left} ${left === 1 ? "try" : "tries"} left.`
      : "Too many wrong codes. Please ask for a new one.";
  }

  user.emailVerified = true;
  user.emailCodeHash = undefined;
  user.emailCodeExpires = undefined;
  user.emailCodeAttempts = 0;
  await user.save();
  return null;
}

module.exports = { sendCode, verifyCode, hasActiveCode };
