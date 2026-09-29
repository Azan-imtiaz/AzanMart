const mongoose = require("mongoose");
const dbgr = require("debug")("azanmart:db");

// Wraps any user-supplied { $ne: ... } style objects in $eq, so a crafted
// request body can't turn a filter into a MongoDB operator (NoSQL injection).
mongoose.set("sanitizeFilter", true);

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
