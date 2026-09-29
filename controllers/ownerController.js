const bcrypt = require("bcrypt");
const ownerModel = require("../models/ownerModel");
const { generateToken, cookieOptions } = require("../utils/generateToken");

// Creates the first (and only) owner. Only mounted in development.
exports.createOwner = async (req, res) => {
  const ownerCount = await ownerModel.countDocuments();
  if (ownerCount > 0) {
    return res.status(403).send("You don't have permission to create a new owner");
  }

  const { fullname, email, password } = req.body;
  if (!fullname || !email || !password) {
    return res.status(400).send("fullname, email and password are required");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const createdOwner = await ownerModel.create({
    fullName: fullname,
    email,
    password: hashedPassword,
  });

  return res.status(201).send({ id: createdOwner._id, email: createdOwner.email });
};

exports.showLogin = (req, res) => {
  res.render("owner-login", { title: "Owner login", loggedIn: false });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const owner = email && (await ownerModel.findOne({ email: email.toLowerCase() }));
  const passwordMatch = owner && password && (await bcrypt.compare(password, owner.password));

  if (!passwordMatch) {
    req.flash("error", "Email or password is incorrect");
    return res.redirect("/owners/login");
  }

  res.cookie("ownerToken", generateToken(owner, "owner"), cookieOptions);
  return res.redirect("/owners/admin");
};

exports.logout = (req, res) => {
  res.clearCookie("ownerToken");
  res.redirect("/owners/login");
};

exports.showAdmin = (req, res) => {
  res.render("createproducts", { title: "Add product", loggedIn: false });
};
