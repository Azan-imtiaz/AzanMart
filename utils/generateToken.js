const jwt = require("jsonwebtoken");

const generateToken = (user, role = "user") => {
  return jwt.sign(
    { email: user.email, id: user._id, role },
    process.env.SECRET_KEY,
    { expiresIn: "1d" }
  );
};

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 24 * 60 * 60 * 1000,
};

module.exports = { generateToken, cookieOptions };
