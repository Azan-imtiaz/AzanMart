const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const connectDB = require("../../config/db");

let server;

async function startDatabase() {
  server = await MongoMemoryServer.create();
  await connectDB(server.getUri());
}

async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function stopDatabase() {
  await mongoose.disconnect();
  await server?.stop();
}

module.exports = { startDatabase, clearDatabase, stopDatabase };
