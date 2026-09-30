const mongoose = require("mongoose");
const productModel = require("../../models/productModel");
const userModel = require("../../models/userModel");
const httpError = require("../../utils/httpError");
const { toCents } = require("../../utils/money");
const { optimizeImage } = require("../../utils/images");

const PAGE_SIZE = 20;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findProduct(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Product not found");
  const product = await productModel.findById(id);
  if (!product) throw httpError(404, "Product not found");
  return product;
}

function readProductForm(body) {
  const { name, description, category, price, discount, stock, bgcolor } = body;
  return {
    name,
    description,
    category,
    price: toCents(price),
    discount: discount || 0,
    stock,
    bgcolor,
  };
}

// Returns null if any upload can't be decoded as an image
async function imagesFrom(files) {
  try {
    return await Promise.all(files.map((file) => optimizeImage(file.buffer)));
  } catch {
    return null;
  }
}

exports.listProducts = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filter = q ? { name: mongoose.trusted({ $regex: escapeRegex(q), $options: "i" }) } : {};

  const [products, total] = await Promise.all([
    productModel
      .find(filter)
      .select("name slug category price finalPrice discount stock bgcolor images._id")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    productModel.countDocuments(filter),
  ]);

  res.render("admin/products", {
    title: "Products",
    products,
    q,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
};

exports.showNewForm = (req, res) => {
  res.render("admin/product-form", {
    title: "Add product",
    product: null,
    categories: productModel.CATEGORIES,
  });
};

exports.createProduct = async (req, res) => {
  if (!req.files?.length) {
    req.flash("error", "Add at least one product image");
    return res.redirect("/admin/products/new");
  }

  const images = await imagesFrom(req.files);
  if (!images) {
    req.flash("error", "One of the files isn't a valid image");
    return res.redirect("/admin/products/new");
  }

  const product = await productModel.create({ ...readProductForm(req.body), images });

  req.flash("success", `${product.name} was created`);
  res.redirect("/admin/products");
};

exports.showEditForm = async (req, res) => {
  const product = await findProduct(req.params.id);
  res.render("admin/product-form", {
    title: `Edit ${product.name}`,
    product,
    categories: productModel.CATEGORIES,
  });
};

exports.updateProduct = async (req, res) => {
  const product = await findProduct(req.params.id);

  product.set(readProductForm(req.body));
  // New uploads replace the gallery; leaving the field empty keeps the current images
  if (req.files?.length) {
    const images = await imagesFrom(req.files);
    if (!images) {
      req.flash("error", "One of the files isn't a valid image");
      return res.redirect(`/admin/products/${product._id}/edit`);
    }
    product.images = images;
  }
  await product.save();

  req.flash("success", `${product.name} was updated`);
  res.redirect("/admin/products");
};

exports.deleteProduct = async (req, res) => {
  const product = await findProduct(req.params.id);
  await product.deleteOne();

  // Past orders keep their own copy of the product, but carts and wishlists shouldn't point at it
  await userModel.updateMany(
    {},
    { $pull: { cart: { product: product._id }, wishlist: product._id } },
  );

  req.flash("success", `${product.name} was deleted`);
  res.redirect("/admin/products");
};
