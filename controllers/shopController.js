const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const reviewModel = require("../models/reviewModel");
const httpError = require("../utils/httpError");
const { toCents, CURRENCY } = require("../utils/money");
const { APP_URL } = require("../config/site");
const { stripe } = require("../utils/stripe");
const cryptoConfig = require("../config/crypto");
const assistantConfig = require("../config/assistant");
const { emailEnabled } = require("../utils/mailer");
const { getGuide } = require("../services/guide");

exports.showHome = async (req, res) => {
  const newArrivals = await productModel
    .find()
    .select("-images.data")
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  // Tells search engines the site has its own search, which can appear as a search box in results
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AzanMart",
    url: APP_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${APP_URL}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  res.render("home", { newArrivals, categories: productModel.CATEGORIES, structuredData });
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

exports.showFeatures = (req, res) => {
  res.render("features", {
    title: "Features",
    description:
      "Everything inside AzanMart: card, crypto and cash payments, an AI shopping assistant, order tracking, an admin dashboard, and the security and performance work behind them.",
    live: {
      card: Boolean(stripe),
      crypto: cryptoConfig.enabled,
      assistant: assistantConfig.enabled,
      email: emailEnabled,
    },
  });
};

exports.showGuide = async (req, res) => {
  const guide = await getGuide();
  res.render("guide", {
    title: "User guide",
    description:
      "How to shop, pay (card, crypto or cash), track orders and run the store on AzanMart.",
    guide,
  });
};

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

exports.showProduct = async (req, res) => {
  const product = await productModel
    .findOne({ slug: req.params.slug })
    .select("-images.data")
    .lean();
  if (!product) throw httpError(404, "We couldn't find that product.");

  const [related, reviews] = await Promise.all([
    productModel
      .find({ category: product.category, _id: mongoose.trusted({ $ne: product._id }) })
      .select("-images.data")
      .limit(4)
      .lean(),
    reviewModel
      .find({ product: product._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("user", "fullName")
      .lean(),
  ]);

  const myReview = req.user && reviews.find((review) => review.user?._id.equals(req.user._id));

  const productUrl = `${APP_URL}/products/${product.slug}`;
  const imageUrls = product.images.map(
    (image) => `${APP_URL}/product-images/${product._id}/${image._id}`,
  );

  // schema.org Product data lets search engines show price, stock and rating in results
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: imageUrls,
    sku: product.slug,
    category: product.category,
    brand: { "@type": "Brand", name: "AzanMart" },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: CURRENCY.toUpperCase(),
      price: (product.finalPrice / 100).toFixed(2),
      availability: `https://schema.org/${product.stock > 0 ? "InStock" : "OutOfStock"}`,
    },
    aggregateRating:
      product.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          }
        : undefined,
  };

  res.render("product", {
    structuredData,
    ogType: "product",
    ogImage: imageUrls[0],
    title: product.name,
    description: product.description.slice(0, 160) || `${product.name} at AzanMart`,
    product,
    related,
    reviews,
    myReview,
  });
};
