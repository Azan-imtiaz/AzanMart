const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const httpError = require("../utils/httpError");
const { ensureDB } = require("../config/db");

exports.sendProductImage = async (req, res) => {
  await ensureDB();
  const { productId, imageId } = req.params;
  if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(imageId)) {
    throw httpError(404, "Image not found");
  }

  // Only pull the one image we need out of the product document
  const product = await productModel
    .findOne({ _id: productId, "images._id": imageId }, { "images.$": 1 })
    .lean();
  const image = product?.images[0];
  if (!image) throw httpError(404, "Image not found");

  // A replaced image gets a new id and so a new URL, which makes it safe to cache forever
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.type(image.contentType).send(image.data.buffer);
};
