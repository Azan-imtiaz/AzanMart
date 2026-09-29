const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const { generateToken, cookieOptions } = require("../utils/generateToken");

// User registration
module.exports.userRegister = async function (req, res) {
  try {
    const { email, password, fullname } = req.body;

    if (!email || !password || !fullname) {
      req.flash("error", "All fields are required");
      return res.redirect("/");
    }

    if (password.length < 6) {
      req.flash("error", "Password must be at least 6 characters");
      return res.redirect("/");
    }

    // Check if user already exists
    const existingUser = await userModel.findOne({ email: email.toLowerCase() });
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
  } catch (err) {
    console.error(err.message);
    req.flash("error", "Something went wrong");
    return res.redirect("/");
  }
};

// User login
module.exports.userLogin = async function (req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash("error", "Email and password are required");
      return res.redirect("/");
    }

    const user = await userModel.findOne({ email: email.toLowerCase() });
    const passwordMatch = user && (await bcrypt.compare(password, user.password));

    if (!passwordMatch) {
      req.flash("error", "Email or password is incorrect");
      return res.redirect("/");
    }

    const token = generateToken(user);
    res.cookie("token", token, cookieOptions);
    return res.redirect("/shop");
  } catch (err) {
    console.error(err.message);
    req.flash("error", "Something went wrong");
    return res.redirect("/");
  }
};

// User logout
module.exports.userLogout = function (req, res) {
  res.clearCookie("token");
  req.flash("success", "Logout successful");
  return res.redirect("/");
};
