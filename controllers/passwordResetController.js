const crypto = require("crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const { sendPasswordReset } = require("../services/emails");
const { APP_URL } = require("../config/site");

const RESET_LINK_TTL = 60 * 60 * 1000; // 1 hour

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function findUserByToken(token) {
  return userModel.findOne({
    passwordResetHash: hashToken(String(token)),
    passwordResetExpires: mongoose.trusted({ $gt: new Date() }),
  });
}

exports.showForgotForm = (req, res) => {
  res.render("auth/forgot-password", { title: "Forgot your password?" });
};

exports.sendResetLink = async (req, res) => {
  const user = await userModel.findOne({ email: req.body.email });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_LINK_TTL);
    await user.save();
    // Not awaited: the response takes the same time whether or not the account exists
    sendPasswordReset(user, `${APP_URL}/reset-password/${token}`);
  }

  // Same message either way, so the form can't be used to find out who has an account
  req.flash(
    "success",
    "If an account exists for that email, we've sent a link to reset the password.",
  );
  res.redirect("/login");
};

exports.showResetForm = async (req, res) => {
  if (!(await findUserByToken(req.params.token))) {
    req.flash("error", "That reset link is invalid or has expired. Please request a new one.");
    return res.redirect("/forgot-password");
  }
  res.render("auth/reset-password", { title: "Choose a new password", token: req.params.token });
};

exports.resetPassword = async (req, res) => {
  const user = await findUserByToken(req.params.token);
  if (!user) {
    req.flash("error", "That reset link is invalid or has expired. Please request a new one.");
    return res.redirect("/forgot-password");
  }

  user.password = await bcrypt.hash(req.body.password, 10);
  user.passwordResetHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  req.flash("success", "Your password was reset. You can log in now.");
  res.redirect("/login");
};
