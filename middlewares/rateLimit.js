const { rateLimit } = require("express-rate-limit");

// Slows down password guessing. Memory store is fine for a single server;
// with several instances this would need a shared store like Redis.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (req, res) => {
    req.flash("error", "Too many attempts. Please wait 15 minutes and try again.");
    res.redirect(req.originalUrl);
  },
});

module.exports = { authLimiter };
