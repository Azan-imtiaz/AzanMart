const mongoose = require("mongoose");
const slugify = require("../utils/slugify");

const CATEGORIES = ["Backpacks", "Handbags", "Totes", "Travel", "Accessories"];

const imageSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, unique: true },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    category: { type: String, enum: CATEGORIES, required: true },
    // All money values are in cents
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, max: 90, default: 0 }, // percent off
    finalPrice: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },
    images: {
      type: [imageSchema],
      validate: [(images) => images.length >= 1 && images.length <= 4, "Add 1 to 4 images"],
    },
    bgcolor: { type: String, default: "#f3f4f6" },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Match the shop's filters and sorts so listing pages use an index instead of a scan
productSchema.index({ category: 1, finalPrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ finalPrice: 1 });
productSchema.index({ ratingAverage: -1, ratingCount: -1 });

// Powers the shop search box; name matches count most
productSchema.index(
  { name: "text", description: "text", category: "text" },
  { weights: { name: 5, category: 2, description: 1 } },
);

// Slugs are set once so product URLs stay stable even if the name changes
productSchema.pre("validate", async function () {
  if (this.slug) return;

  const base = slugify(this.name) || "product";
  let slug = base;
  for (let n = 2; await this.constructor.exists({ slug }); n++) {
    slug = `${base}-${n}`;
  }
  this.slug = slug;
});

// Stored instead of computed on read so the shop can sort and filter by it
productSchema.pre("save", function () {
  this.finalPrice = Math.round((this.price * (100 - this.discount)) / 100);
});

module.exports = mongoose.model("product", productSchema);
module.exports.CATEGORIES = CATEGORIES;
