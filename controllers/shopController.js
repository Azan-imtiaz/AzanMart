const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const httpError = require("../utils/httpError");
const { toCents } = require("../utils/money");

exports.showHome = async (req, res) => {
  const newArrivals = await productModel
    .find()
    .select("-images.data")
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  res.render("home", { newArrivals, categories: productModel.CATEGORIES });
};

exports.showAbout = (req, res) => {
  res.render("about", {
    title: "About the developer",
    description:
      "AzanMart is designed and developed by Azan Imtiaz, a Software Engineering graduate and MERN & Blockchain developer.",
  });
};

const PAGE_SIZE = 12;

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  "price-asc": { finalPrice: 1 },
  "price-desc": { finalPrice: -1 },
  rating: { ratingAverage: -1, ratingCount: -1 },
};

// Reads the shop's query string into clean values; anything unexpected is ignored
function readShopQuery(query) {
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const number = (value) => (Number(text(value)) > 0 ? Number(text(value)) : null);

  return {
    q: text(query.q).slice(0, 100),
    category: productModel.CATEGORIES.includes(query.category) ? query.category : "",
    min: number(query.min),
    max: number(query.max),
    sale: query.sale === "1",
    inStock: query.instock === "1",
    sort: SORT_OPTIONS[query.sort] ? query.sort : "",
    page: Math.max(1, Math.floor(number(query.page) || 1)),
  };
}

// Operators we build ourselves are marked trusted so sanitizeFilter lets them through
function buildFilter({ q, category, min, max, sale, inStock }) {
  const filter = {};
  if (q) filter.$text = mongoose.trusted({ $search: q });
  if (category) filter.category = category;
  if (min || max) {
    const range = {};
    if (min) range.$gte = toCents(min);
    if (max) range.$lte = toCents(max);
    filter.finalPrice = mongoose.trusted(range);
  }
  if (sale) filter.discount = mongoose.trusted({ $gt: 0 });
  if (inStock) filter.stock = mongoose.trusted({ $gt: 0 });
  return filter;
}

exports.showShop = async (req, res) => {
  const options = readShopQuery(req.query);
  const filter = buildFilter(options);

  // With a search term and no explicit sort, best matches come first
  let sort = SORT_OPTIONS[options.sort || "newest"];
  if (options.q && !options.sort) sort = { score: { $meta: "textScore" } };

  const [products, total] = await Promise.all([
    productModel
      .find(filter, options.q ? { score: { $meta: "textScore" } } : {})
      .select("-images.data")
      .sort(sort)
      .skip((options.page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    productModel.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Keeps the current filters when moving between pages
  const pageUrl = (page) => {
    const params = new URLSearchParams();
    for (const key of ["q", "category", "min", "max", "sort"]) {
      if (options[key]) params.set(key, options[key]);
    }
    if (options.sale) params.set("sale", "1");
    if (options.inStock) params.set("instock", "1");
    if (page > 1) params.set("page", page);
    const query = params.toString();
    return query ? `/shop?${query}` : "/shop";
  };

  res.render("shop", {
    title: options.category || (options.q ? `Search: ${options.q}` : "Shop"),
    products,
    total,
    options,
    totalPages,
    pageUrl,
    categories: productModel.CATEGORIES,
    hasFilters: Object.keys(filter).length > 0,
  });
};

exports.addToCart = async (req, res) => {
  const { productid } = req.params;
  if (!mongoose.isValidObjectId(productid) || !(await productModel.exists({ _id: productid }))) {
    throw httpError(404, "Product not found");
  }

  await userModel.updateOne({ _id: req.user._id }, { $push: { cart: productid } });
  req.flash("success", "Added to cart");
  res.redirect("/shop");
};

exports.showCart = async (req, res) => {
  const user = await userModel
    .findById(req.user._id)
    .populate({ path: "cart", select: "-images.data" });
  // Drop items whose product has been deleted
  user.cart = user.cart.filter(Boolean);
  res.render("cart", { title: "Your cart", user });
};
