const mongoose = require("mongoose");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const httpError = require("../utils/httpError");
const safeRedirect = require("../utils/safeRedirect");

exports.showWishlist = async (req, res) => {
  const user = await userModel
    .findById(req.user._id)
    .select("wishlist")
    .populate({ path: "wishlist", select: "-images.data" })
    .lean();

  res.render("wishlist", {
    title: "Wishlist",
    products: (user.wishlist ?? []).filter(Boolean),
  });
};

exports.toggleItem = async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId) || !(await productModel.exists({ _id: productId }))) {
    throw httpError(404, "Product not found");
  }

  const saved = (req.user.wishlist ?? []).some((id) => id.equals(productId));
  const update = saved
    ? { $pull: { wishlist: productId } }
    : { $addToSet: { wishlist: productId } };
  await userModel.updateOne({ _id: req.user._id }, update);

  req.flash("success", saved ? "Removed from your wishlist" : "Saved to your wishlist");
  res.redirect(safeRedirect(req.body.returnTo, "/wishlist"));
};
