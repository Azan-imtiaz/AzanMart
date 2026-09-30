// Fills the database with demo products, customers, orders and reviews.
// It deletes existing data first, so it refuses to run in production.
// Usage: npm run seed
require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
const orderModel = require("../models/orderModel");
const reviewModel = require("../models/reviewModel");
const { optimizeImage } = require("../utils/images");
const { SHIPPING_FEE, FREE_SHIPPING_FROM } = require("../services/cart");
const data = require("../seed/data");

// Published in the README so visitors can try the demo
const DEMO_ADMIN = {
  email: "admin@azanmart.dev",
  password: "Admin@12345",
  fullName: "Azan Imtiaz",
};
const DEMO_CUSTOMER = {
  email: "demo@azanmart.dev",
  password: "Demo@12345",
  fullName: "Demo Shopper",
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function seedProducts() {
  const products = [];
  for (const [index, item] of data.products.entries()) {
    const file = await fs.readFile(path.join(__dirname, "../seed/images", item.image));
    const product = new productModel({
      ...item,
      price: Math.round(item.price * 100),
      images: [await optimizeImage(file)],
    });
    // Spread creation dates so "newest" sorting has something to show; the first
    // product in the list is the newest, and the home page hero features it
    product.createdAt = daysAgo(index + 1);
    await product.save();
    products.push(product);
  }
  return products;
}

async function seedUsers() {
  const hash = (password) => bcrypt.hash(password, 10);
  const admin = await userModel.create({
    ...DEMO_ADMIN,
    password: await hash(DEMO_ADMIN.password),
    role: "admin",
  });
  const demo = await userModel.create({
    ...DEMO_CUSTOMER,
    password: await hash(DEMO_CUSTOMER.password),
  });

  const sharedPassword = await hash(crypto.randomBytes(12).toString("hex"));
  const others = await userModel.insertMany(
    data.customers.map((fullName) => ({
      fullName,
      email: `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      password: sharedPassword,
    })),
  );
  return { admin, customers: [demo, ...others] };
}

function randomOrder(user, products, createdAt) {
  const chosen = [...products]
    .sort(() => Math.random() - 0.5)
    .slice(0, 1 + Math.floor(Math.random() * 3));
  const items = chosen.map((product) => ({
    product: product._id,
    name: product.name,
    slug: product.slug,
    imageUrl: `/product-images/${product._id}/${product.images[0]._id}`,
    price: product.finalPrice,
    quantity: 1 + Math.floor(Math.random() * 2),
  }));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

  // Older orders are further along, like in a real shop
  const age = (Date.now() - createdAt) / (24 * 60 * 60 * 1000);
  const status =
    Math.random() < 0.08
      ? "cancelled"
      : age > 7
        ? "delivered"
        : age > 3
          ? "shipped"
          : age > 1
            ? "processing"
            : "pending";
  const paymentMethod = Math.random() < 0.6 ? "card" : "cod";
  const paid =
    status !== "cancelled" &&
    (paymentMethod === "card" ? status !== "pending" : status === "delivered");
  const [city, postalCode] = pick(data.cities);

  return {
    orderNumber: `AZM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    user: user._id,
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    shippingAddress: {
      fullName: user.fullName,
      phone: "0300 1234567",
      line1: `${10 + Math.floor(Math.random() * 90)} Main Boulevard`,
      city,
      postalCode,
      country: "Pakistan",
    },
    paymentMethod,
    paymentStatus: paid ? "paid" : "unpaid",
    status,
    paidAt: paid ? createdAt : undefined,
    createdAt,
    updatedAt: createdAt,
  };
}

async function seedOrders(customers, products) {
  const orders = [];
  for (let day = 29; day >= 0; day--) {
    const perDay = Math.floor(Math.random() * 3);
    for (let i = 0; i < perDay; i++) {
      const createdAt = daysAgo(day + Math.random() * 0.9);
      orders.push(randomOrder(pick(customers), products, createdAt));
    }
  }
  return orderModel.insertMany(orders);
}

async function seedReviews(customers, products, orders) {
  for (const product of products) {
    const reviewers = [...customers]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 4));
    for (const user of reviewers) {
      const bought = orders.some(
        (order) =>
          order.user.equals(user._id) &&
          order.items.some((item) => item.product.equals(product._id)),
      );
      await reviewModel.create({
        product: product._id,
        user: user._id,
        ...pick(data.reviews),
        verifiedPurchase: bought,
      });
    }
    await reviewModel.updateProductRating(product._id);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.log("Refusing to seed a production database. Pass --force if you really mean it.");
    process.exit(1);
  }

  await connectDB();
  console.log(`Seeding ${mongoose.connection.name}...`);

  await Promise.all([
    productModel.deleteMany({}),
    userModel.deleteMany({}),
    orderModel.deleteMany({}),
    reviewModel.deleteMany({}),
    mongoose.connection.collection("sessions").deleteMany({}),
  ]);

  const products = await seedProducts();
  const { customers } = await seedUsers();
  const orders = await seedOrders(customers, products);
  await seedReviews(customers, products, orders);

  console.log(
    `Created ${products.length} products, ${customers.length + 1} users and ${orders.length} orders.`,
  );
  console.log(`Admin:    ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
  console.log(`Customer: ${DEMO_CUSTOMER.email} / ${DEMO_CUSTOMER.password}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
