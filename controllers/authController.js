const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");

// Only allow redirects back into this site, never to another domain
function safeReturnTo(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

// A new session id on login prevents session fixation attacks
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

exports.register = async (req, res) => {
  const { email, password, fullname } = req.body;

  const existingUser = await userModel.findOne({ email });
  if (existingUser) {
    req.flash("error", "You already have an account, please log in");
    return res.redirect("/");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await userModel.create({ email, password: hashedPassword, fullName: fullname });

  req.flash("success", "Account created successfully, please log in");
  res.redirect("/");
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });
  const passwordMatch = user && (await bcrypt.compare(password, user.password));

  if (!passwordMatch) {
    req.flash("error", "Email or password is incorrect");
    return res.redirect("/");
  }

  const returnTo = safeReturnTo(req.session.returnTo);
  await regenerateSession(req);
  req.session.userId = user._id.toString();

  res.redirect(returnTo || (user.role === "admin" ? "/admin" : "/shop"));
};

exports.logout = async (req, res) => {
  await regenerateSession(req);
  req.flash("success", "You have been logged out");
  res.redirect("/");
};
