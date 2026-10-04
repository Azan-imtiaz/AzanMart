const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const orderModel = require("../models/orderModel");
const reviewModel = require("../models/reviewModel");
const httpError = require("../utils/httpError");
const { ensureDB } = require("../config/db");

async function findProduct(slug) {
  const product = await productModel.findOne({ slug }).select("_id slug").lean();
  if (!product) throw httpError(404, "We couldn't find that product.");
  return product;
}

exports.saveReview = async (req, res) => {
  await ensureDB();
  const product = await findProduct(req.params.slug);
  const { rating, comment } = req.body;

  const verifiedPurchase = Boolean(
    await orderModel.exists({
      user: req.user._id,
      "items.product": product._id,
      status: mongoose.trusted({ $ne: "cancelled" }),
    }),
  );

  // Posting again updates the shopper's existing review instead of adding a second one
  await reviewModel.findOneAndUpdate(
    { product: product._id, user: req.user._id },
    { rating, comment, verifiedPurchase },
    { upsert: true, runValidators: true },
  );
  await reviewModel.updateProductRating(product._id);

  req.flash("success", "Thanks for your review!");
  res.redirect(`/products/${product.slug}#reviews`);
};

exports.deleteReview = async (req, res) => {
  await ensureDB();
  const product = await findProduct(req.params.slug);

  // Shoppers remove their own review; admins can remove any (for moderation)
  const filter =
    req.user.role === "admin" && mongoose.isValidObjectId(req.body.reviewId)
      ? { _id: req.body.reviewId, product: product._id }
      : { product: product._id, user: req.user._id };

  await reviewModel.deleteOne(filter);
  await reviewModel.updateProductRating(product._id);

  req.flash("success", "Review removed");
  res.redirect(`/products/${product.slug}#reviews`);
};
