const crypto = require("crypto");
const { ethers } = require("ethers");
const config = require("../config/crypto");
const orderModel = require("../models/orderModel");

// USDC has 6 decimals and our prices are in cents: 1 cent = 10,000 units
const CENT_IN_UNITS = 10_000n;
const transferEvent = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const TRANSFER_TOPIC = transferEvent.getEvent("Transfer").topicHash;

let provider;
function getProvider() {
  provider ??= new ethers.JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
  return provider;
}

// Lets tests point the service at a fake blockchain
function setProvider(fake) {
  provider = fake;
}

// Each order gets an amount no other open crypto order has: the total plus a
// fraction of a cent. A transaction can then only ever match one order, so
// nobody can claim someone else's payment for an order with the same total.
async function uniquePaymentAmount(totalCents) {
  const base = BigInt(totalCents) * CENT_IN_UNITS;
  for (;;) {
    const amount = (base + BigInt(crypto.randomInt(1, 10_000))).toString();
    const taken = await orderModel.exists({ status: "pending", "crypto.amount": amount });
    if (!taken) return amount;
  }
}

function formatUsdc(units) {
  return ethers.formatUnits(units, 6);
}

const isTxHash = (value) => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

// Checks a transaction against an order. Returns { status, message } where
// status is "paid", "pending" (not mined or confirmed yet) or "failed".
async function verifyPayment(order, txHash) {
  if (!isTxHash(txHash)) {
    return { status: "failed", message: "That doesn't look like a transaction hash." };
  }

  const chain = getProvider();
  const receipt = await chain.getTransactionReceipt(txHash);
  if (!receipt) {
    return { status: "pending", message: "Waiting for the transaction to be included in a block." };
  }
  if (receipt.status !== 1) {
    return {
      status: "failed",
      message: "This transaction failed on the blockchain, so nothing was paid.",
    };
  }
  // Ask the node directly: ethers can return a slightly stale block number here,
  // which makes a freshly mined payment look unconfirmed
  const latestBlock = Number(await chain.send("eth_blockNumber", []));
  if (latestBlock - receipt.blockNumber + 1 < config.confirmations) {
    return { status: "pending", message: "Waiting for the network to confirm the transaction." };
  }

  // An older transfer to the store must not count as payment for a new order
  const block = await chain.getBlock(receipt.blockNumber);
  if (block.timestamp * 1000 < new Date(order.createdAt).getTime() - 60_000) {
    return { status: "failed", message: "This transaction was made before the order was placed." };
  }

  const expected = BigInt(order.crypto.amount);
  const paidToStore = receipt.logs
    .filter((log) => log.address.toLowerCase() === config.token && log.topics[0] === TRANSFER_TOPIC)
    .map((log) => transferEvent.parseLog(log))
    .filter((event) => event.args.to.toLowerCase() === config.receiver)
    .reduce((sum, event) => sum + event.args.value, 0n);

  if (paidToStore === 0n) {
    return {
      status: "failed",
      message: "This transaction didn't send USDC to the store's wallet.",
    };
  }
  if (paidToStore !== expected) {
    return {
      status: "failed",
      message: `This transaction sent ${formatUsdc(paidToStore)} USDC, but the order needs exactly ${formatUsdc(expected)} USDC.`,
    };
  }

  return { status: "paid", payer: receipt.from.toLowerCase() };
}

module.exports = { verifyPayment, uniquePaymentAmount, formatUsdc, isTxHash, setProvider };
