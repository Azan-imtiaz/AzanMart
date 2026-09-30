const bcrypt = require("bcrypt");
const userModel = require("../../models/userModel");
const productModel = require("../../models/productModel");

let counter = 0;

async function createUser({ role = "customer", password = "password123", ...fields } = {}) {
  counter += 1;
  const user = await userModel.create({
    fullName: `Test User ${counter}`,
    email: `user${counter}@example.com`,
    password: await bcrypt.hash(password, 4),
    role,
    emailVerified: true,
    ...fields,
  });
  return { user, password };
}

function createProduct(fields = {}) {
  counter += 1;
  return productModel.create({
    name: `Test Bag ${counter}`,
    category: "Backpacks",
    price: 2000,
    stock: 10,
    images: [{ data: Buffer.from("fake image"), contentType: "image/png" }],
    ...fields,
  });
}

module.exports = { createUser, createProduct };
