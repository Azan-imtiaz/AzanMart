const productModel = require("../models/productModel");
const { toCents } = require("../utils/money");

exports.showNewProduct = (req, res) => {
  res.render("admin/product-form", {
    title: "Add product",
    categories: productModel.CATEGORIES,
  });
};

exports.createProduct = async (req, res) => {
  if (!req.files?.length) {
    req.flash("error", "Add at least one product image");
    return res.redirect("/admin");
  }

  const { name, description, category, price, discount, stock, bgcolor } = req.body;
  await productModel.create({
    name,
    description,
    category,
    price: toCents(price),
    discount: discount || 0,
    stock,
    bgcolor,
    images: req.files.map((file) => ({ data: file.buffer, contentType: file.mimetype })),
  });

  req.flash("success", "Product created successfully");
  res.redirect("/admin");
};
