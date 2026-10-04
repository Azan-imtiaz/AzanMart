const config = require("../config/assistant");
const { answer, AssistantApiError } = require("../services/assistant");
const { ensureDB } = require("../config/db");

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
  await ensureDB();
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
    if (!(err instanceof AssistantApiError)) throw err;
    if (err.status === 429) return res.status(429).json({ error: BUSY });
    if (err.status === 401 || err.status === 403) {
      console.error("Assistant: the NVIDIA API key was rejected");
    } else if (err.status === 0) {
      console.error("Assistant: could not reach the NVIDIA API:", err.message);
    } else {
      console.error(`Assistant: API error ${err.status}:`, err.message);
    }
    res.status(503).json({ error: UNAVAILABLE });
  }
};
