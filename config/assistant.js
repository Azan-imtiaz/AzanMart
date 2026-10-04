// The AI shopping assistant. Off unless an Anthropic API key is set.
module.exports = {
  enabled: Boolean(process.env.ANTHROPIC_API_KEY),
  model: "claude-opus-5-5",
  // Chat answers are short and simple, so low effort keeps them quick and cheap
  effort: "low",
  maxTokens: 8000,
  // Upper limit on search/lookup rounds for one question
  maxToolRounds: 4,
  maxMessageLength: 1000,
  maxHistory: 12,
};
