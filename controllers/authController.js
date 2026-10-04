const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const safeRedirect = require("../utils/safeRedirect");
const { sendCode } = require("../services/verification");
const { ensureDB } = require("../config/db");

// A new session id on login prevents session fixation attacks
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// Logged-in users have no reason to see the login or register forms
function redirectIfLoggedIn(req, res) {
  if (!req.user) return false;
  res.redirect(req.user.role === "admin" ? "/admin" : "/shop");
  return true;
}

async function logIn(req, user) {
  const returnTo = safeRedirect(req.session.returnTo, null);
  await regenerateSession(req);
  req.session.userId = user._id.toString();
  return returnTo || (user.role === "admin" ? "/admin" : "/shop");
}

exports.showLogin = (req, res) => {
  if (redirectIfLoggedIn(req, res)) return;
  res.render("auth/login", { title: "Log in" });
};

exports.showRegister = (req, res) => {
  if (redirectIfLoggedIn(req, res)) return;
  res.render("auth/register", { title: "Create an account" });
};

exports.register = async (req, res) => {
  await ensureDB();
  const { email, password, fullname } = req.body;

  if (await userModel.exists({ email })) {
    req.flash("error", "You already have an account, please log in");
    return res.redirect("/login");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await userModel.create({ email, password: hashedPassword, fullName: fullname });

  // Send them to confirm their email first, then on to where they were going
  req.session.afterVerify = await logIn(req, user);
  await sendCode(user);
  req.flash(
    "success",
    `Welcome to AzanMart, ${user.fullName.split(" ")[0]}! Check your inbox for a code.`,
  );
  res.redirect("/verify-email");
};

exports.login = async (req, res) => {
  await ensureDB();
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });
  const passwordMatch = user && (await bcrypt.compare(password, user.password));

  if (!passwordMatch) {
    req.flash("error", "Email or password is incorrect");
    return res.redirect("/login");
  }

  res.redirect(await logIn(req, user));
};

exports.logout = async (req, res) => {
  await ensureDB();
  await regenerateSession(req);
  req.flash("success", "You have been logged out");
  res.redirect("/");
};
