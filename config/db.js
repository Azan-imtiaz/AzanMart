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

// Resolves with the MongoDB client once Mongoose is connected, however long that
// takes. connection.asPromise() is not enough: called before connect() it
// resolves straight away, before there is a client.
function whenConnected() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection.getClient());
  }
  return new Promise((resolve) => {
    mongoose.connection.once("open", () => resolve(mongoose.connection.getClient()));
  });
}

module.exports = connectDB;
module.exports.whenConnected = whenConnected;
