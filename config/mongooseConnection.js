const mongoose = require("mongoose");
const dbgr = require("debug")("development:mongoose");

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    dbgr("Connected to MongoDB");
  })
  .catch((err) => {
    console.error(`Error connecting to database: ${err.message}`);
    process.exit(1);
  });

module.exports = mongoose.connection;
