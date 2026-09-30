const userModel = require("../models/userModel");
const httpError = require("../utils/httpError");

// Loads the logged-in user on every request so views can use currentUser
async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.cartCount = 0;
  res.locals.wishlistIds = new Set();
  if (!req.session.userId) return next();

  const user = await userModel
    .findById(req.session.userId)
    .select("-password -passwordResetHash -passwordResetExpires -emailCodeHash")
    .lean();
  if (user) {
    req.user = user;
    res.locals.currentUser = user;
    res.locals.cartCount = (user.cart ?? []).reduce((sum, item) => sum + item.quantity, 0);
    // Accounts created before a field existed may not have it yet
    res.locals.wishlistIds = new Set((user.wishlist ?? []).map(String));
  } else {
    // The account was deleted while the session was still alive
    delete req.session.userId;
  }
  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();

  if (req.method === "GET") req.session.returnTo = req.originalUrl;
  req.flash("error", "Please log in to continue");
  res.redirect("/login");
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  if (req.user.role !== "admin") {
    return next(httpError(403, "You don't have access to this page."));
  }
  next();
}

// Accounts from before email verification existed have no emailVerified value
// at all, so only an explicit false counts as unverified
function requireVerifiedEmail(req, res, next) {
  if (req.user.emailVerified !== false) return next();

  req.session.afterVerify = req.method === "GET" ? req.originalUrl : "/checkout";
  req.flash("error", "Please verify your email address before placing an order.");
  res.redirect("/verify-email");
}

module.exports = { loadUser, requireAuth, requireAdmin, requireVerifiedEmail };
