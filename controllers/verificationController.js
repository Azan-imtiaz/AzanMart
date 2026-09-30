const userModel = require("../models/userModel");
const safeRedirect = require("../utils/safeRedirect");
const { sendCode, verifyCode, hasActiveCode } = require("../services/verification");

exports.showForm = async (req, res) => {
  if (req.user.emailVerified !== false) return res.redirect("/account");

  // Send a code automatically if there isn't a usable one yet
  const user = await userModel.findById(req.user._id);
  if (!hasActiveCode(user)) await sendCode(user);

  res.render("auth/verify-email", { title: "Verify your email", email: user.email });
};

exports.verify = async (req, res) => {
  const user = await userModel.findById(req.user._id);
  if (user.emailVerified) return res.redirect("/account");

  const expired = !hasActiveCode(user);
  const error = await verifyCode(user, req.body.code);
  if (error) {
    // An expired code can't be used, so send a fresh one right away
    if (expired) await sendCode(user);
    req.flash("error", error);
    return res.redirect("/verify-email");
  }

  const next = safeRedirect(req.session.afterVerify, "/shop");
  delete req.session.afterVerify;
  req.flash("success", "Thanks! Your email address is verified.");
  res.redirect(next);
};

exports.resend = async (req, res) => {
  const user = await userModel.findById(req.user._id);
  if (user.emailVerified) return res.redirect("/account");

  const error = await sendCode(user);
  req.flash(error ? "error" : "success", error || `We sent a new code to ${user.email}`);
  res.redirect("/verify-email");
};
