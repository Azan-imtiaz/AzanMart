require("dotenv").config();

// Fail fast if required secrets are missing
const requiredEnv = ["MONGODB_URL", "SESSION_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = require("./app");
const connectDB = require("./config/db");
const { checkMailer } = require("./utils/mailer");
const { cancelExpiredCryptoOrders } = require("./services/orders");

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`AzanMart is running on http://localhost:${PORT}`);
  });
  checkMailer();

  // Release stock held by crypto orders that were never paid
  setInterval(() => cancelExpiredCryptoOrders().catch((err) => console.error(err)), 60_000).unref();
});
