const Stripe = require("stripe");
const productModel = require("../models/productModel");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { app, request, loginAs, postForm } = require("./helpers/http");

// Stripe API calls are mocked; webhook signing uses the real SDK, which works offline
jest.mock("../utils/stripe", () => {
  const RealStripe = jest.requireActual("stripe");
  return {
    stripe: {
      webhooks: new RealStripe("sk_test_dummy").webhooks,
      checkout: { sessions: { create: jest.fn(), retrieve: jest.fn(), expire: jest.fn() } },
    },
  };
});
jest.mock("../utils/mailer", () => ({ sendMail: jest.fn() }));

const { stripe } = require("../utils/stripe");
const { sendMail } = require("../utils/mailer");

beforeAll(startDatabase);
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
afterAll(stopDatabase);

const address = {
  fullName: "Card Buyer",
  phone: "0300 1234567",
  line1: "1 Main Boulevard",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
};

let sessionCounter = 0;
stripe.checkout.sessions.create.mockImplementation(async () => {
  sessionCounter += 1;
  const id = `cs_test_${sessionCounter}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}` };
});

async function startCardCheckout({ price = 3000, stock = 5, quantity = 2 } = {}) {
  const account = await createUser();
  const product = await createProduct({ price, stock });
  await userModel.updateOne(
    { _id: account.user._id },
    { cart: [{ product: product._id, quantity }] },
  );
  const agent = await loginAs(account);
  const res = await postForm(
    agent,
    "/checkout",
    { ...address, paymentMethod: "card" },
    "/checkout",
  );
  const order = await orderModel.findOne({ user: account.user._id }).sort({ createdAt: -1 });
  return { account, agent, product, res, order };
}

function sendWebhook(type, session) {
  const payload = JSON.stringify({ id: "evt_test", type, data: { object: session } });
  const signature = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return request(app)
    .post("/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", signature)
    .send(payload);
}

describe("card checkout", () => {
  it("redirects to Stripe with the right line items and reserves stock", async () => {
    const { res, order, product, account } = await startCardCheckout({ price: 1500, quantity: 2 });

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("https://checkout.stripe.com/c/pay/" + order.stripeSessionId);
    expect(order).toMatchObject({
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: "card",
    });

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.metadata.orderId).toBe(String(order._id));
    expect(params.line_items).toEqual([
      expect.objectContaining({
        quantity: 2,
        price_data: expect.objectContaining({ unit_amount: 1500 }),
      }),
      expect.objectContaining({
        price_data: expect.objectContaining({ product_data: { name: "Shipping" } }),
      }),
    ]);

    // Stock is held, but the cart is only cleared once payment is confirmed
    expect((await productModel.findById(product._id)).stock).toBe(3);
    expect((await userModel.findById(account.user._id)).cart).toHaveLength(1);
  });

  it("confirms the payment when the shopper returns from Stripe", async () => {
    const { agent, order, account } = await startCardCheckout();
    stripe.checkout.sessions.retrieve.mockResolvedValue({ payment_status: "paid" });

    await agent.get(`/orders/${order.orderNumber}?session_id=${order.stripeSessionId}`);

    const paid = await orderModel.findById(order._id);
    expect(paid).toMatchObject({ paymentStatus: "paid", status: "processing" });
    expect((await userModel.findById(account.user._id)).cart).toHaveLength(0);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("cancels the order and returns the stock if Stripe is unreachable", async () => {
    stripe.checkout.sessions.create.mockRejectedValueOnce(new Error("Stripe is down"));
    jest.spyOn(console, "error").mockImplementation(() => {}); // the failure is logged on purpose

    const { res, order, product } = await startCardCheckout({ stock: 5, quantity: 2 });

    expect(res.headers.location).toBe("/checkout");
    expect(order.status).toBe("cancelled");
    expect((await productModel.findById(product._id)).stock).toBe(5);
  });

  it("cancels an abandoned card order when the shopper starts a new checkout", async () => {
    const { agent, order: first, product } = await startCardCheckout({ stock: 5, quantity: 2 });
    stripe.checkout.sessions.expire.mockResolvedValueOnce({ status: "expired" });

    await postForm(agent, "/checkout", { ...address, paymentMethod: "card" }, "/checkout");

    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith(first.stripeSessionId);
    expect((await orderModel.findById(first._id)).status).toBe("cancelled");
    // Stock is reserved once, for the new order only
    expect((await productModel.findById(product._id)).stock).toBe(3);
  });

  it("keeps the earlier order if it turns out to be paid already", async () => {
    const { agent, order: first } = await startCardCheckout({ stock: 5, quantity: 1 });
    stripe.checkout.sessions.expire.mockRejectedValueOnce(new Error("Session is complete"));
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce({ payment_status: "paid" });

    await postForm(agent, "/checkout", { ...address, paymentMethod: "card" }, "/checkout");

    expect(await orderModel.findById(first._id)).toMatchObject({
      status: "processing",
      paymentStatus: "paid",
    });
  });
});

describe("Stripe webhook", () => {
  it("rejects requests without a valid signature", async () => {
    const res = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "t=1,v1=forged")
      .send(JSON.stringify({ type: "checkout.session.completed" }));

    expect(res.status).toBe(400);
  });

  it("marks the order paid once, even if the event is delivered twice", async () => {
    const { order } = await startCardCheckout();
    const session = { payment_status: "paid", metadata: { orderId: String(order._id) } };

    const first = await sendWebhook("checkout.session.completed", session);
    await sendWebhook("checkout.session.completed", session);

    expect(first.status).toBe(200);
    expect((await orderModel.findById(order._id)).paymentStatus).toBe("paid");
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("cancels expired sessions and puts the stock back", async () => {
    const { order, product } = await startCardCheckout({ stock: 5, quantity: 2 });

    await sendWebhook("checkout.session.expired", { metadata: { orderId: String(order._id) } });

    expect((await orderModel.findById(order._id)).status).toBe("cancelled");
    expect((await productModel.findById(product._id)).stock).toBe(5);
  });

  it("ignores a late expiry for an order that was already paid", async () => {
    const { order, product } = await startCardCheckout({ stock: 5, quantity: 2 });
    const metadata = { orderId: String(order._id) };

    await sendWebhook("checkout.session.completed", { payment_status: "paid", metadata });
    await sendWebhook("checkout.session.expired", { metadata });

    expect((await orderModel.findById(order._id)).status).toBe("processing");
    expect((await productModel.findById(product._id)).stock).toBe(3);
  });
});
