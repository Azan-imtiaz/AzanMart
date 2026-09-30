const sharp = require("sharp");
const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { csrfToken, loginAs, postForm } = require("./helpers/http");

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

const photo = () =>
  sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#8b4513" } })
    .jpeg()
    .toBuffer();

async function adminAgent() {
  return loginAs(await createUser({ role: "admin" }));
}

// Multipart forms send the CSRF token in the query string
async function uploadProduct(agent, url, fields, files = []) {
  const token = await csrfToken(agent, "/admin/products/new");
  const req = agent.post(`${url}?_csrf=${token}`);
  for (const [key, value] of Object.entries(fields)) req.field(key, String(value));
  for (const file of files)
    req.attach("images", file.buffer, { filename: file.name, contentType: file.type });
  return req;
}

const fields = {
  name: "Admin Bag",
  category: "Travel",
  price: "49.99",
  discount: "20",
  stock: "7",
};

describe("admin products", () => {
  it("creates a product with a resized WebP image and cents pricing", async () => {
    const agent = await adminAgent();

    const res = await uploadProduct(agent, "/admin/products", fields, [
      { buffer: await photo(), name: "bag.jpg", type: "image/jpeg" },
    ]);

    expect(res.headers.location).toBe("/admin/products");
    const product = await productModel.findOne({ name: "Admin Bag" });
    expect(product).toMatchObject({
      price: 4999,
      discount: 20,
      finalPrice: 3999,
      stock: 7,
      slug: "admin-bag",
    });
    expect(product.images[0].contentType).toBe("image/webp");
    const { width } = await sharp(product.images[0].data).metadata();
    expect(width).toBe(1000);
  });

  it("rejects files that are not real images", async () => {
    const agent = await adminAgent();

    await uploadProduct(agent, "/admin/products", fields, [
      { buffer: Buffer.from("GIF89a but not really"), name: "fake.gif", type: "image/gif" },
    ]);

    expect(await productModel.countDocuments()).toBe(0);
  });

  it("rejects SVG uploads", async () => {
    const agent = await adminAgent();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    await uploadProduct(agent, "/admin/products", fields, [
      { buffer: svg, name: "x.svg", type: "image/svg+xml" },
    ]);

    expect(await productModel.countDocuments()).toBe(0);
  });

  it("keeps the images and slug when a product is edited without new uploads", async () => {
    const product = await createProduct({ name: "Old Name" });
    const agent = await adminAgent();

    await uploadProduct(agent, `/admin/products/${product._id}`, { ...fields, name: "New Name" });

    const updated = await productModel.findById(product._id);
    expect(updated.name).toBe("New Name");
    expect(updated.slug).toBe(product.slug);
    expect(String(updated.images[0]._id)).toBe(String(product.images[0]._id));
  });

  it("removes a deleted product from carts and wishlists", async () => {
    const product = await createProduct();
    const { user } = await createUser({ cart: [{ product: product._id, quantity: 1 }] });
    await userModel.updateOne({ _id: user._id }, { wishlist: [product._id] });
    const agent = await adminAgent();

    await postForm(agent, `/admin/products/${product._id}/delete`, {}, "/admin/products");

    const shopper = await userModel.findById(user._id);
    expect(await productModel.countDocuments()).toBe(0);
    expect(shopper.cart).toHaveLength(0);
    expect(shopper.wishlist).toHaveLength(0);
  });

  it("renders the dashboard with chart data", async () => {
    const agent = await adminAgent();
    const res = await agent.get("/admin");
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="dashboard-data"');
  });
});

describe("admin users", () => {
  it("lets an admin promote others but not change their own role", async () => {
    const admin = await createUser({ role: "admin" });
    const { user: shopper } = await createUser();
    const agent = await loginAs(admin);

    await postForm(agent, `/admin/users/${shopper._id}/role`, { role: "admin" }, "/admin/users");
    await postForm(
      agent,
      `/admin/users/${admin.user._id}/role`,
      { role: "customer" },
      "/admin/users",
    );

    expect((await userModel.findById(shopper._id)).role).toBe("admin");
    expect((await userModel.findById(admin.user._id)).role).toBe("admin");
  });
});
