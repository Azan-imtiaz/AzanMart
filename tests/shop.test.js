const reviewModel = require("../models/reviewModel");
const productModel = require("../models/productModel");
const { startDatabase, clearDatabase, stopDatabase } = require("./helpers/db");
const { createUser, createProduct } = require("./helpers/factories");
const { app, request, loginAs, postForm } = require("./helpers/http");

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

const names = (html) =>
  [...html.matchAll(/<a href="\/products\/[^"]+" class="hover:[^"]*">([^<]+)<\/a>/g)].map(
    (m) => m[1],
  );

describe("shop listing", () => {
  beforeEach(async () => {
    await createProduct({
      name: "Leather Backpack",
      category: "Backpacks",
      price: 9000,
      description: "full grain leather",
    });
    await createProduct({ name: "Canvas Tote", category: "Totes", price: 2000, discount: 10 });
    await createProduct({ name: "Travel Duffel", category: "Travel", price: 12000, stock: 0 });
  });

  it("is public and lists every product", async () => {
    const res = await request(app).get("/shop");
    expect(res.status).toBe(200);
    expect(names(res.text)).toHaveLength(3);
  });

  it("searches names and descriptions", async () => {
    const res = await request(app).get("/shop?q=leather");
    expect(names(res.text)).toEqual(["Leather Backpack"]);
  });

  it("filters by category, price, sale and stock", async () => {
    expect(names((await request(app).get("/shop?category=Totes")).text)).toEqual(["Canvas Tote"]);
    expect(names((await request(app).get("/shop?min=50&max=100")).text)).toEqual([
      "Leather Backpack",
    ]);
    expect(names((await request(app).get("/shop?sale=1")).text)).toEqual(["Canvas Tote"]);
    expect(names((await request(app).get("/shop?instock=1")).text)).not.toContain("Travel Duffel");
  });

  it("sorts by price", async () => {
    const res = await request(app).get("/shop?sort=price-asc");
    expect(names(res.text)).toEqual(["Canvas Tote", "Leather Backpack", "Travel Duffel"]);
  });

  it("ignores junk query values instead of failing", async () => {
    const res = await request(app).get("/shop?category=Shoes&min=-3&page=abc&sort=hack");
    expect(res.status).toBe(200);
    expect(names(res.text)).toHaveLength(3);
  });

  it("paginates 12 products per page", async () => {
    await Promise.all(Array.from({ length: 12 }, () => createProduct()));
    const page1 = await request(app).get("/shop");
    const page2 = await request(app).get("/shop?page=2");
    expect(names(page1.text)).toHaveLength(12);
    expect(names(page2.text)).toHaveLength(3);
  });
});

describe("product page", () => {
  it("renders with structured data, and 404s for unknown slugs", async () => {
    const product = await createProduct({ name: "Heritage Backpack", price: 5000 });

    const res = await request(app).get(`/products/${product.slug}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('"@type":"Product"');
    expect(res.text).toContain('"price":"50.00"');

    expect((await request(app).get("/products/does-not-exist")).status).toBe(404);
  });

  it("serves product images with a long cache", async () => {
    const product = await createProduct();
    const res = await request(app).get(`/product-images/${product._id}/${product.images[0]._id}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
  });
});

describe("reviews", () => {
  it("keeps one review per shopper and updates the product's average", async () => {
    const product = await createProduct();
    const first = await loginAs(await createUser());
    const second = await loginAs(await createUser());
    const page = `/products/${product.slug}`;

    await postForm(first, `${page}/reviews`, { rating: 5, comment: "Love it" }, page);
    await postForm(second, `${page}/reviews`, { rating: 2 }, page);
    await postForm(second, `${page}/reviews`, { rating: 4 }, page);

    const updated = await productModel.findById(product._id);
    expect(await reviewModel.countDocuments()).toBe(2);
    expect(updated.ratingAverage).toBe(4.5);
    expect(updated.ratingCount).toBe(2);
  });

  it("rejects ratings outside 1 to 5", async () => {
    const product = await createProduct();
    const agent = await loginAs(await createUser());
    const page = `/products/${product.slug}`;

    await postForm(agent, `${page}/reviews`, { rating: 9 }, page);

    expect(await reviewModel.countDocuments()).toBe(0);
  });
});

describe("SEO and health", () => {
  it("lists products in the sitemap and hides private pages in robots.txt", async () => {
    const product = await createProduct();

    const sitemap = await request(app).get("/sitemap.xml");
    expect(sitemap.headers["content-type"]).toContain("xml");
    expect(sitemap.text).toContain(`/products/${product.slug}`);

    const robots = await request(app).get("/robots.txt");
    expect(robots.text).toContain("Disallow: /admin");
    expect(robots.text).toContain("Sitemap:");
  });

  it("reports health with the database status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "up" });
  });

  it("shows the features page and the user guide with working in-page links", async () => {
    expect((await request(app).get("/features")).text).toContain("Everything inside");

    const guide = await request(app).get("/guide");
    expect(guide.status).toBe(200);
    const anchors = [...guide.text.matchAll(/href="#([\w-]+)"/g)].map((match) => match[1]);
    expect(anchors.length).toBeGreaterThan(10);
    for (const anchor of anchors) expect(guide.text).toContain(`id="${anchor}"`);
    expect(guide.text).toContain('src="/guide/screenshots/');
  });

  it("renders a friendly 404 page", async () => {
    const res = await request(app).get("/nowhere");
    expect(res.status).toBe(404);
    expect(res.text).toContain("Page not found");
  });
});
