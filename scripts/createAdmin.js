// Creates an admin account, or promotes an existing user to admin.
// Usage: npm run create-admin -- <email> <password> [full name]
require("dotenv").config();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const userModel = require("../models/userModel");

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  if (!email || !password) {
    console.log("Usage: npm run create-admin -- <email> <password> [full name]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.log("Admin passwords must be at least 8 characters.");
    process.exit(1);
  }

  await connectDB();

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await userModel.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      password: hashedPassword,
      role: "admin",
      $setOnInsert: { fullName: nameParts.join(" ") || "Admin" },
    },
    { upsert: true, new: true },
  );

  console.log(`Admin ready: ${admin.email}`);
  await mongoose.disconnect();
}

main();
