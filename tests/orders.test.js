const productModel = require("../models/productModel");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { csrfToken, loginAs, postForm } = require("./helpers/http");

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

const address = {
  fullName: "Test Buyer",
  phone: "0300 1234567",
  line1: "1 Main Boulevard",
  city: "Lahore",
  postalCode: "54000",
  country: "Pakistan",
};

async function withCart(account, items) {
  await userModel.updateOne({ _id: account.user._id }, { cart: items });
  return loginAs(account);
}

const checkout = (agent, extra = {}) =>
  postForm(agent, "/checkout", { ...address, paymentMethod: "cod", ...extra }, "/checkout");

describe("cash on delivery checkout", () => {
  it("creates an order, takes the stock and empties the cart", async () => {
    const account = await createUser();
    const product = await createProduct({ price: 3000, stock: 5 });
    const agent = await withCart(account, [{ product: product._id, quantity: 2 }]);

    const res = await checkout(agent);

    const order = await orderModel.findOne({ user: account.user._id }).lean();
    expect(res.headers.location).toBe(`/orders/${order.orderNumber}`);
    expect(order).toMatchObject({
      status: "processing",
      paymentMethod: "cod",
      subtotal: 6000,
      total: 6000,
    });
    expect(order.items[0]).toMatchObject({ name: product.name, price: 3000, quantity: 2 });
    expect((await productModel.findById(product._id)).stock).toBe(3);
    expect((await userModel.findById(account.user._id)).cart).toHaveLength(0);
  });

  it("requires a complete shipping address", async () => {
    const account = await createUser();
    const product = await createProduct();
    const agent = await withCart(account, [{ product: product._id, quantity: 1 }]);

    const res = await checkout(agent, { city: "" });

    expect(res.headers.location).toBe("/checkout");
    expect(await orderModel.countDocuments()).toBe(0);
  });

  it("sells the last unit only once when two shoppers check out together", async () => {
    const product = await createProduct({ stock: 1 });
    const first = await createUser();
    const second = await createUser();
    const agents = await Promise.all([
      withCart(first, [{ product: product._id, quantity: 1 }]),
      withCart(second, [{ product: product._id, quantity: 1 }]),
    ]);

    await Promise.all(agents.map((agent) => checkout(agent)));

    expect(await orderModel.countDocuments()).toBe(1);
    expect((await productModel.findById(product._id)).stock).toBe(0);
  });

  it("puts back stock already taken if a later item has run out", async () => {
    const account = await createUser();
    const plenty = await createProduct({ stock: 5 });
    const scarce = await createProduct({ stock: 1 });
    const agent = await withCart(account, [
      { product: plenty._id, quantity: 2 },
      { product: scarce._id, quantity: 1 },
    ]);
    // The shopper opens checkout, then someone else buys the scarce item before they submit
    const _csrf = await csrfToken(agent, "/checkout");
    await productModel.updateOne({ _id: scarce._id }, { stock: 0 });

    await agent
      .post("/checkout")
      .type("form")
      .send({ _csrf, ...address, paymentMethod: "cod" });

    expect(await orderModel.countDocuments()).toBe(0);
    expect((await productModel.findById(plenty._id)).stock).toBe(5);
  });
});

describe("order pages", () => {
  it("shows an order to its owner but not to other shoppers", async () => {
    const owner = await createUser();
    const product = await createProduct();
    const ownerAgent = await withCart(owner, [{ product: product._id, quantity: 1 }]);
    await checkout(ownerAgent);
    const { orderNumber } = await orderModel.findOne().lean();

    const otherAgent = await loginAs(await createUser());

    expect((await ownerAgent.get(`/orders/${orderNumber}`)).status).toBe(200);
    expect((await otherAgent.get(`/orders/${orderNumber}`)).status).toBe(404);
    expect((await ownerAgent.get("/orders")).text).toContain(orderNumber);
  });
});

describe("admin order status", () => {
  async function placeOrder(stock = 5) {
    const account = await createUser();
    const product = await createProduct({ stock });
    const agent = await withCart(account, [{ product: product._id, quantity: 2 }]);
    await checkout(agent);
    const order = await orderModel.findOne().lean();
    const admin = await loginAs(await createUser({ role: "admin" }));
    const setStatus = (status) =>
      postForm(
        admin,
        `/admin/orders/${order.orderNumber}/status`,
        { status },
        `/admin/orders/${order.orderNumber}`,
      );
    return { product, order, setStatus };
  }

  it("marks cash on delivery orders as paid when delivered", async () => {
    const { order, setStatus } = await placeOrder();

    await setStatus("shipped");
    await setStatus("delivered");

    const updated = await orderModel.findById(order._id);
    expect(updated.status).toBe("delivered");
    expect(updated.paymentStatus).toBe("paid");
  });

  it("restocks when an order is cancelled and then locks it", async () => {
    const { product, order, setStatus } = await placeOrder(5);
    expect((await productModel.findById(product._id)).stock).toBe(3);

    await setStatus("cancelled");
    await setStatus("processing");

    expect((await productModel.findById(product._id)).stock).toBe(5);
    expect((await orderModel.findById(order._id)).status).toBe("cancelled");
  });
});
