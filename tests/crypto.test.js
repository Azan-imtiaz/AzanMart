// Crypto checkout must be switched on before the app is loaded
process.env.CRYPTO_RECEIVER_ADDRESS = "0x" + "22".repeat(20);

const { ethers } = require("ethers");
const orderModel = require("../models/orderModel");
const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
const cryptoConfig = require("../config/crypto");
const { setProvider, verifyPayment } = require("../services/crypto");
const { cancelExpiredCryptoOrders } = require("../services/orders");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { csrfToken, loginAs, postForm } = require("./helpers/http");

jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));
const { sendMail } = require("../utils/mailer");

// A pretend blockchain: receipts are looked up by hash, the chain is at block 100
const transfer = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const PAYER = "0x" + "11".repeat(20);
const chain = { receipts: {}, latestBlock: 100, blockTime: Date.now() };
setProvider({
  getTransactionReceipt: async (hash) => chain.receipts[hash] || null,
  send: async () => "0x" + chain.latestBlock.toString(16),
  getBlock: async () => ({ timestamp: Math.floor(chain.blockTime / 1000) }),
});

let hashCounter = 0;
function fakeTransfer({
  amount,
  to = cryptoConfig.receiver,
  token = cryptoConfig.token,
  status = 1,
  block = 99,
}) {
  hashCounter += 1;
  const hash = "0x" + hashCounter.toString(16).padStart(64, "0");
  const { topics, data } = transfer.encodeEventLog("Transfer", [PAYER, to, BigInt(amount)]);
  chain.receipts[hash] = {
    status,
    blockNumber: block,
    from: PAYER,
    logs: [{ address: token, topics, data }],
  };
  return hash;
}

beforeAll(startDatabase);
beforeEach(() => {
  chain.receipts = {};
  chain.blockTime = Date.now();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(stopDatabase);

const address = {
  fullName: "Crypto Buyer",
  phone: "0300 1234567",
  line1: "1 Main Boulevard",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
};

async function startCryptoCheckout({ price = 3999, stock = 5 } = {}) {
  const account = await createUser();
  const product = await createProduct({ price, stock });
  await userModel.updateOne(
    { _id: account.user._id },
    { cart: [{ product: product._id, quantity: 1 }] },
  );
  const agent = await loginAs(account);
  const res = await postForm(
    agent,
    "/checkout",
    { ...address, paymentMethod: "crypto" },
    "/checkout",
  );
  const order = await orderModel.findOne({ user: account.user._id }).sort({ createdAt: -1 });
  return { account, agent, product, res, order };
}

async function confirm(agent, order, txHash) {
  const _csrf = await csrfToken(agent, `/orders/${order.orderNumber}/pay`);
  return agent
    .post(`/orders/${order.orderNumber}/crypto`)
    .set("X-CSRF-Token", _csrf)
    .send({ txHash });
}

describe("crypto checkout", () => {
  it("creates a pending order with a unique amount and opens the payment page", async () => {
    const { res, order, agent, product } = await startCryptoCheckout({ price: 3999 });

    expect(res.headers.location).toBe(`/orders/${order.orderNumber}/pay`);
    expect(order).toMatchObject({ paymentMethod: "crypto", status: "pending" });
    // The order total (with shipping) plus less than a cent, in 6-decimal units
    const totalInUnits = BigInt(order.total) * 10_000n;
    const amount = BigInt(order.crypto.amount);
    expect(amount > totalInUnits && amount < totalInUnits + 10_000n).toBe(true);
    expect((await productModel.findById(product._id)).stock).toBe(4);

    const page = await agent.get(`/orders/${order.orderNumber}/pay`);
    expect(page.text).toContain(ethers.formatUnits(order.crypto.amount, 6));
  });

  it("gives two orders with the same total different amounts", async () => {
    const first = await startCryptoCheckout({ price: 2500 });
    const second = await startCryptoCheckout({ price: 2500 });

    expect(first.order.crypto.amount).not.toBe(second.order.crypto.amount);
  });

  it("marks the order paid when the exact amount reaches the store wallet", async () => {
    const { agent, order, account } = await startCryptoCheckout();
    const txHash = fakeTransfer({ amount: order.crypto.amount });

    const res = await confirm(agent, order, txHash);

    expect(res.body.status).toBe("paid");
    const paid = await orderModel.findById(order._id);
    expect(paid).toMatchObject({ paymentStatus: "paid", status: "processing" });
    expect(paid.crypto).toMatchObject({ txHash, payer: PAYER });
    expect((await userModel.findById(account.user._id)).cart).toHaveLength(0);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("waits while the transaction isn't mined or confirmed yet", async () => {
    const { agent, order } = await startCryptoCheckout();
    const unconfirmed = fakeTransfer({ amount: order.crypto.amount, block: 101 });

    expect((await confirm(agent, order, "0x" + "ab".repeat(32))).body.status).toBe("pending");
    expect((await confirm(agent, order, unconfirmed)).body.status).toBe("pending");
    expect((await orderModel.findById(order._id)).paymentStatus).toBe("unpaid");
  });

  it.each([
    [
      "the wrong amount",
      (order) => ({ amount: BigInt(order.crypto.amount) - 1n }),
      /needs exactly/,
    ],
    ["the wrong wallet", (order) => ({ amount: order.crypto.amount, to: PAYER }), /store's wallet/],
    ["another token", (order) => ({ amount: order.crypto.amount, token: PAYER }), /store's wallet/],
    ["a failed transaction", (order) => ({ amount: order.crypto.amount, status: 0 }), /failed/],
  ])("rejects %s", async (_, makeTransfer, message) => {
    const { agent, order } = await startCryptoCheckout();
    const txHash = fakeTransfer(makeTransfer(order));

    const res = await confirm(agent, order, txHash);

    expect(res.body.status).toBe("failed");
    expect(res.body.message).toMatch(message);
    expect((await orderModel.findById(order._id)).paymentStatus).toBe("unpaid");
  });

  it("rejects a transfer made before the order was placed", async () => {
    const { order } = await startCryptoCheckout();
    chain.blockTime = Date.now() - 3 * 60 * 60 * 1000;
    const txHash = fakeTransfer({ amount: order.crypto.amount });

    const result = await verifyPayment(order, txHash);

    expect(result.message).toMatch(/before the order was placed/);
  });

  it("never lets one transaction pay for two orders", async () => {
    const first = await startCryptoCheckout();
    const txHash = fakeTransfer({ amount: first.order.crypto.amount });
    await confirm(first.agent, first.order, txHash);

    // Pretend the same transaction also matched a second order's amount
    const second = await startCryptoCheckout();
    chain.receipts[txHash].logs = fakeTransferLogs(second.order.crypto.amount);
    const res = await confirm(second.agent, second.order, txHash);

    expect(res.body.message).toMatch(/already been used/);
    expect((await orderModel.findById(second.order._id)).paymentStatus).toBe("unpaid");
  });

  it("doesn't let another shopper confirm or view the payment page", async () => {
    const { order } = await startCryptoCheckout();
    const stranger = await loginAs(await createUser());

    expect((await stranger.get(`/orders/${order.orderNumber}/pay`)).status).toBe(404);
  });

  it("cancels unpaid orders after the payment window and restocks them", async () => {
    const { order, product } = await startCryptoCheckout({ stock: 5 });
    await orderModel.updateOne(
      { _id: order._id },
      { "crypto.expiresAt": new Date(Date.now() - 10 * 60 * 1000) },
    );

    expect(await cancelExpiredCryptoOrders()).toBe(1);
    expect((await orderModel.findById(order._id)).status).toBe("cancelled");
    expect((await productModel.findById(product._id)).stock).toBe(5);
  });

  it("keeps orders still inside the grace period", async () => {
    const { order } = await startCryptoCheckout();
    await orderModel.updateOne(
      { _id: order._id },
      { "crypto.expiresAt": new Date(Date.now() - 60 * 1000) },
    );

    expect(await cancelExpiredCryptoOrders()).toBe(0);
  });
});

function fakeTransferLogs(amount) {
  const { topics, data } = transfer.encodeEventLog("Transfer", [
    PAYER,
    cryptoConfig.receiver,
    BigInt(amount),
  ]);
  return [{ address: cryptoConfig.token, topics, data }];
}
