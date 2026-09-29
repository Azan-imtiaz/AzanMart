const express = require("express");
const bcrypt = require("bcrypt");
const ownerModel = require("../models/ownerModel");
const { isOwner } = require("../middlewares/isOwner");
const { generateToken, cookieOptions } = require("../utils/generateToken");

const router = express.Router();

// Bootstrap route: creates the first (and only) owner. Available in development only.
if (process.env.NODE_ENV === "development") {
  router.post("/create", async (req, res) => {
    try {
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
    } catch (err) {
      console.error(err.message);
      return res.status(500).send("Something went wrong");
    }
  });
}

router.get("/login", (req, res) => {
  const error = req.flash("error");
  res.render("owner-login", {
    title: "Owner login",
    error: error.length ? error : null,
    loggedIn: false,
  });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const owner = email && (await ownerModel.findOne({ email: email.toLowerCase() }));
    const passwordMatch = owner && password && (await bcrypt.compare(password, owner.password));

    if (!passwordMatch) {
      req.flash("error", "Email or password is incorrect");
      return res.redirect("/owners/login");
    }

    res.cookie("ownerToken", generateToken(owner, "owner"), cookieOptions);
    return res.redirect("/owners/admin");
  } catch (err) {
    console.error(err.message);
    req.flash("error", "Something went wrong");
    return res.redirect("/owners/login");
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("ownerToken");
  res.redirect("/owners/login");
});

router.get("/admin", isOwner, (req, res) => {
  const success = req.flash("success");
  const error = req.flash("error");
  res.render("createproducts", { title: "Add product", success, error, loggedIn: false });
});

module.exports = router;
