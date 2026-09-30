const userModel = require("../models/userModel");
const { getCart } = require("../services/cart");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { app, request, loginAs, postForm } = require("./helpers/http");

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

async function cartOf(user) {
  const { cart } = await userModel.findById(user._id).lean();
  return cart.map((item) => ({ product: String(item.product), quantity: item.quantity }));
}

describe("cart", () => {
  it("requires an account", async () => {
    const res = await request(app).get("/cart");
    expect(res.headers.location).toBe("/login");
  });

  it("adds a product and merges repeated adds into one line", async () => {
    const account = await createUser();
    const product = await createProduct({ stock: 5 });
    const agent = await loginAs(account);

    await postForm(agent, `/cart/items/${product._id}`, { quantity: 2 });
    await postForm(agent, `/cart/items/${product._id}`, { quantity: 1 });

    expect(await cartOf(account.user)).toEqual([{ product: String(product._id), quantity: 3 }]);
  });

  it("never lets the cart hold more than is in stock", async () => {
    const account = await createUser();
    const product = await createProduct({ stock: 2 });
    const agent = await loginAs(account);

    await postForm(agent, `/cart/items/${product._id}`, { quantity: 2 });
    await postForm(agent, `/cart/items/${product._id}`, { quantity: 1 });
    await postForm(agent, `/cart/items/${product._id}/quantity`, { quantity: 5 }, "/cart");

    expect(await cartOf(account.user)).toEqual([{ product: String(product._id), quantity: 2 }]);
  });

  it("refuses sold-out products", async () => {
    const account = await createUser();
    const product = await createProduct({ stock: 0 });
    const agent = await loginAs(account);

    await postForm(agent, `/cart/items/${product._id}`);

    expect(await cartOf(account.user)).toEqual([]);
  });

  it("updates quantities and removes items", async () => {
    const account = await createUser();
    const product = await createProduct({ stock: 10 });
    const agent = await loginAs(account);

    await postForm(agent, `/cart/items/${product._id}`);
    await postForm(agent, `/cart/items/${product._id}/quantity`, { quantity: 4 }, "/cart");
    expect(await cartOf(account.user)).toEqual([{ product: String(product._id), quantity: 4 }]);

    await postForm(agent, `/cart/items/${product._id}/remove`, {}, "/cart");
    expect(await cartOf(account.user)).toEqual([]);
  });

  it("only redirects back to pages on this site", async () => {
    const agent = await loginAs(await createUser());
    const product = await createProduct();

    const res = await postForm(agent, `/cart/items/${product._id}`, { returnTo: "//evil.example" });

    expect(res.headers.location).toBe("/cart");
  });
});

describe("cart totals", () => {
  it("adds shipping below the free-shipping threshold", async () => {
    const { user } = await createUser();
    const product = await createProduct({ price: 1999, stock: 5 });
    await userModel.updateOne({ _id: user._id }, { cart: [{ product: product._id, quantity: 1 }] });

    const cart = await getCart(user._id);

    expect(cart.subtotal).toBe(1999);
    expect(cart.shipping).toBe(500);
    expect(cart.total).toBe(2499);
  });

  it("uses the discounted price and ships free from $50", async () => {
    const { user } = await createUser();
    const product = await createProduct({ price: 4000, discount: 25, stock: 5 }); // $30 each
    await userModel.updateOne({ _id: user._id }, { cart: [{ product: product._id, quantity: 2 }] });

    const cart = await getCart(user._id);

    expect(cart.subtotal).toBe(6000);
    expect(cart.shipping).toBe(0);
    expect(cart.itemCount).toBe(2);
  });

  it("flags items when stock drops below the cart quantity", async () => {
    const { user } = await createUser();
    const product = await createProduct({ stock: 1 });
    await userModel.updateOne({ _id: user._id }, { cart: [{ product: product._id, quantity: 3 }] });

    const cart = await getCart(user._id);

    expect(cart.hasStockProblems).toBe(true);
  });
});
