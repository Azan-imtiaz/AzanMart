const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
    verifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One review per shopper per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

// Keeps the average on the product so listings can show and sort by it without a join
reviewSchema.statics.updateProductRating = async function (productId) {
  const [stats] = await this.aggregate([
    { $match: { product: productId } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await mongoose.model("product").updateOne(
    { _id: productId },
    {
      ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
      ratingCount: stats?.count || 0,
    },
  );
};

module.exports = mongoose.model("review", reviewSchema);
