// The AI shopping assistant, using NVIDIA's API. Off unless an API key is set.
module.exports = {
  enabled: Boolean(process.env.NVIDIA_API_KEY),
  baseUrl: (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(
    /\/$/,
    "",
  ),
  model: process.env.NVIDIA_MODEL || "nvidia/nemotron-3-super-120b-a12b",
  // Low temperature keeps answers close to the catalog data
  temperature: 0.2,
  maxTokens: 2048,
  timeoutMs: 30_000,
  // Upper limit on search/lookup rounds for one question
  maxToolRounds: 4,
  maxMessageLength: 1000,
  maxHistory: 12,
};
