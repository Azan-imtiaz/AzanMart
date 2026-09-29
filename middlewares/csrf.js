const crypto = require("crypto");
const httpError = require("../utils/httpError");

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function tokensMatch(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Synchronizer token pattern: one random token per session, which every
// form sends back. Another site can't read it, so it can't forge requests.
function csrf(req, res, next) {
  // Created lazily so visitors who never see a form don't get a session
  res.locals.csrfToken = () => {
    req.session.csrfToken ??= crypto.randomBytes(32).toString("hex");
    return req.session.csrfToken;
  };

  if (SAFE_METHODS.includes(req.method)) return next();

  // Multipart forms are parsed later by multer, so they send the token in the query string
  const sent = req.body?._csrf || req.get("x-csrf-token") || req.query._csrf;
  const expected = req.session.csrfToken;

  if (!sent || !expected || !tokensMatch(sent, expected)) {
    return next(httpError(403, "This form has expired. Please refresh the page and try again."));
  }
  next();
}

module.exports = csrf;
