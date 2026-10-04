// USDC payments on an EVM network. Defaults to Base Sepolia, a free test network,
// so nobody pays real money in the demo. Crypto checkout is on only when the
// store has a wallet address to receive payments.
const config = {
  receiver: (process.env.CRYPTO_RECEIVER_ADDRESS || "").toLowerCase(),
  rpcUrl: process.env.CRYPTO_RPC_URL || "https://sepolia.base.org",
  // Sent to the shopper's wallet. Kept separate because CRYPTO_RPC_URL may contain an API key.
  publicRpcUrl: process.env.CRYPTO_PUBLIC_RPC_URL || "https://sepolia.base.org",
  chainId: Number(process.env.CRYPTO_CHAIN_ID) || 84532,
  networkName: process.env.CRYPTO_NETWORK_NAME || "Base Sepolia",
  // Circle's test USDC on Base Sepolia
  token: (
    process.env.CRYPTO_TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  ).toLowerCase(),
  explorerUrl: process.env.CRYPTO_EXPLORER_URL || "https://sepolia.basescan.org",
  confirmations: Number(process.env.CRYPTO_CONFIRMATIONS) || 1,
  paymentWindowMinutes: 30,
};

config.enabled = /^0x[0-9a-f]{40}$/.test(config.receiver);
config.isTestnet = config.chainId !== 1 && config.chainId !== 8453;

module.exports = config;
