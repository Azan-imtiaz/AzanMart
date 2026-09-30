const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const { sendCode } = require("../services/verification");

exports.showAccount = (req, res) => {
  res.render("account", { title: "Your account" });
};

exports.updateProfile = async (req, res) => {
  const { fullname, email } = req.body;

  const emailTaken = await userModel.exists({
    email,
    _id: mongoose.trusted({ $ne: req.user._id }),
  });
  if (emailTaken) {
    req.flash("error", "Another account already uses that email");
    return res.redirect("/account");
  }

  const user = await userModel.findById(req.user._id);
  const emailChanged = user.email !== email;
  user.fullName = fullname;

  if (!emailChanged) {
    await user.save();
    req.flash("success", "Your details were saved");
    return res.redirect("/account");
  }

  // A new address has to be confirmed before it's trusted for orders
  user.email = email;
  user.emailVerified = false;
  user.emailCodeSentAt = undefined;
  await sendCode(user);

  req.session.afterVerify = "/account";
  req.flash("success", `Your details were saved. We sent a code to ${email} to confirm it.`);
  res.redirect("/verify-email");
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await userModel.findById(req.user._id);
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    req.flash("error", "Your current password is incorrect");
    return res.redirect("/account");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  req.flash("success", "Your password was changed");
  res.redirect("/account");
};
