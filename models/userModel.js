const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    cart: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
        quantity: { type: Number, min: 1, default: 1 },
        _id: false,
      },
    ],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("user", userSchema);
