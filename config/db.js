const mongoose = require("mongoose");
const dbgr = require("debug")("azanmart:db");

async function connectDB(url = process.env.MONGODB_URL) {
  try {
    await mongoose.connect(url);
    dbgr("Connected to MongoDB");
  } catch (err) {
    console.error(`Could not connect to MongoDB: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
