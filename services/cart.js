const userModel = require("../models/userModel");

const SHIPPING_FEE = 500; // cents
const FREE_SHIPPING_FROM = 5000;

// Loads a user's cart with current product prices and stock. Items whose
// product was deleted are dropped; items with too little stock are flagged.
async function getCart(userId) {
  const user = await userModel
    .findById(userId)
    .select("cart")
    .populate({ path: "cart.product", select: "-images.data" })
    .lean();

  const items = user.cart
    .filter((item) => item.product)
    .map(({ product, quantity }) => ({
      product,
      quantity,
      lineTotal: product.finalPrice * quantity,
      inStock: product.stock >= quantity,
    }));

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

  return {
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    hasStockProblems: items.some((item) => !item.inStock),
  };
}

module.exports = { getCart, SHIPPING_FEE, FREE_SHIPPING_FROM };
