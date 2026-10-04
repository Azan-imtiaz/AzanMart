const express = require("express");
const { rateLimit } = require("express-rate-limit");
const assistant = require("../controllers/assistantController");

const router = express.Router();

// Every question costs an API call, so each visitor gets a sensible allowance
const assistantLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (req, res) =>
    res.status(429).json({ error: "You've asked a lot of questions. Please wait a few minutes." }),
});

router.post("/chat", assistantLimiter, assistant.chat);

module.exports = router;
