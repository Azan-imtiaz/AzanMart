const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const userModel = require("../models/userModel");

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

  await userModel.updateOne({ _id: req.user._id }, { fullName: fullname, email });
  req.flash("success", "Your details were saved");
  res.redirect("/account");
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
