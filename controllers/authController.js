const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const { generateToken, cookieOptions } = require("../utils/generateToken");

// User registration
module.exports.userRegister = async function (req, res) {
  const { email, password, fullname } = req.body;

  // Check if user already exists
  const existingUser = await userModel.findOne({ email: email });
  if (existingUser) {
    req.flash("error", "You already have an account, please log in");
    return res.redirect("/");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await userModel.create({
    email: email,
    password: hashedPassword,
    fullName: fullname,
  });

  req.flash("success", "Account created successfully, please log in");
  return res.redirect("/");
};

// User login
module.exports.userLogin = async function (req, res) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email: email });
  const passwordMatch = user && (await bcrypt.compare(password, user.password));

  if (!passwordMatch) {
    req.flash("error", "Email or password is incorrect");
    return res.redirect("/");
  }

  const token = generateToken(user);
  res.cookie("token", token, cookieOptions);
  return res.redirect("/shop");
};

// User logout
module.exports.userLogout = function (req, res) {
  res.clearCookie("token");
  req.flash("success", "Logout successful");
  return res.redirect("/");
};
