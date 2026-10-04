const Anthropic = require("@anthropic-ai/sdk").default;
const config = require("../config/assistant");
const { answer } = require("../services/assistant");

const BUSY = "I'm getting a lot of questions right now. Please try again in a minute.";
const UNAVAILABLE =
  "The assistant isn't available right now. You can still browse and search the shop.";

// Accepts only plain text turns of a sensible size; anything else is dropped
function readHistory(body) {
  if (!Array.isArray(body.messages)) return null;
  const history = body.messages
    .slice(-config.maxHistory)
    .filter(
      (message) =>
        ["user", "assistant"].includes(message?.role) && typeof message.content === "string",
    )
    .map(({ role, content }) => ({
      role,
      content: content.trim().slice(0, config.maxMessageLength),
    }))
    .filter((message) => message.content);

  // The API needs the conversation to start and end with the shopper
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length || history[history.length - 1].role !== "user") return null;
  return history;
}

exports.chat = async (req, res) => {
  if (!config.enabled) return res.status(503).json({ error: UNAVAILABLE });

  const history = readHistory(req.body);
  if (!history) return res.status(400).json({ error: "Please type a question." });

  try {
    const { reply, products } = await answer({
      history,
      productSlug: typeof req.body.productSlug === "string" ? req.body.productSlug : null,
    });
    res.json({ reply, products });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: BUSY });
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Assistant: the Anthropic API key was rejected");
    } else if (err instanceof Anthropic.APIConnectionError) {
      console.error("Assistant: could not reach the Anthropic API:", err.message);
    } else if (err instanceof Anthropic.APIError) {
      console.error(`Assistant: API error ${err.status}:`, err.message);
    } else {
      throw err;
    }
    res.status(503).json({ error: UNAVAILABLE });
  }
};
