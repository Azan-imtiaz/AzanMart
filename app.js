const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const adminRouter = require("./routes/adminRouter");
const authRouter = require("./routes/authRouter");
const cartRouter = require("./routes/cartRouter");
const wishlistRouter = require("./routes/wishlistRouter");
const checkoutRouter = require("./routes/checkoutRouter");
const ordersRouter = require("./routes/ordersRouter");
const accountRouter = require("./routes/accountRouter");
const assistantRouter = require("./routes/assistantRouter");
const index = require("./routes/index");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const flash = require("./middlewares/flash");
const { loadUser } = require("./middlewares/auth");
const csrf = require("./middlewares/csrf");
const { formatPrice } = require("./utils/money");
const { APP_URL, ASSET_VERSION, DEMO_MODE } = require("./config/site");
const { whenConnected } = require("./config/db");
const cryptoConfig = require("./config/crypto");
const { stripe } = require("./utils/stripe");
const { FREE_SHIPPING_FROM } = require("./services/cart");
const assistantConfig = require("./config/assistant");
const { sendProductImage } = require("./controllers/imageController");
const { handleStripeEvent } = require("./controllers/webhookController");
const seo = require("./controllers/seoController");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
// HTTPS-only settings follow the real URL, so a production build can still be
// tried over plain http://localhost (for example with docker compose)
const isHttps = APP_URL.startsWith("https://");
const SESSION_TTL_DAYS = 7;

app.disable("x-powered-by");
// Behind Render/Railway's proxy, so secure cookies work over HTTPS
if (isProduction) app.set("trust proxy", 1);

// Used by uptime checks and the hosting platform; registered before
// logging and sessions so health pings stay cheap and quiet.
app.get("/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down" });
});

app.use(compression());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(isProduction ? "combined" : "dev"));
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        // Product colours come from the database as inline style attributes
        "style-src-attr": ["'unsafe-inline'"],
        "font-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        // Checkout posts to us, then redirects to Stripe's hosted payment page
        "form-action": ["'self'", "https://checkout.stripe.com"],
        "upgrade-insecure-requests": isHttps ? [] : null,
      },
    },
    strictTransportSecurity: isHttps,
  }),
);

// Set first so the error page can always render, even if a later middleware fails
app.use((req, res, next) => {
  res.locals.appUrl = APP_URL;
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.originalUrl;
  next();
});

// Static files are served before sessions so they never touch the session store
// Asset URLs carry ?v=<version>, so a long cache is safe in production
const staticMaxAge = isProduction ? "30d" : 0;
app.use(express.static(path.join(__dirname, "public"), { maxAge: staticMaxAge }));
// Screenshots used by the in-app user guide
app.use(
  "/guide/screenshots",
  express.static(path.join(__dirname, "docs/screenshots"), { maxAge: staticMaxAge }),
);
app.use(
  "/vendor/remixicon",
  express.static(path.join(__dirname, "node_modules/remixicon/fonts"), { maxAge: staticMaxAge }),
);
app.use(
  "/vendor/chart.js",
  express.static(path.join(__dirname, "node_modules/chart.js/dist"), { maxAge: staticMaxAge }),
);
app.get("/product-images/:productId/:imageId", sendProductImage);
app.get("/robots.txt", seo.robots);
app.get("/sitemap.xml", seo.sitemap);

// Needs the raw body to check Stripe's signature, and has no session or CSRF token
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeEvent);

app.use(express.json());
// Flat form bodies only: no nested objects like email[$ne]=... reach the controllers
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: "azanmart.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      // Reuse the Mongoose connection instead of opening a second one
      clientPromise: whenConnected(),
      ttl: SESSION_TTL_DAYS * 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(flash);
app.use(loadUser);
app.use(csrf);

app.set("view engine", "ejs");
app.locals.formatPrice = formatPrice;
app.locals.demoMode = DEMO_MODE;
app.locals.assistantEnabled = assistantConfig.enabled;
app.locals.cryptoEnabled = cryptoConfig.enabled;
app.locals.cardEnabled = Boolean(stripe);
app.locals.freeShippingFrom = FREE_SHIPPING_FROM;
app.locals.paymentLabels = {
  cod: "Cash on delivery",
  card: "Card (Stripe)",
  crypto: "USDC (crypto)",
};
app.locals.txUrl = (hash) => `${cryptoConfig.explorerUrl}/tx/${hash}`;
app.locals.asset = (url) => `${url}?v=${ASSET_VERSION}`;
// For data embedded in <script type="application/json">: escaping "<" means a
// value like "</script>" can't end the tag early
app.locals.safeJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
app.locals.imageUrl = (product, index = 0) =>
  `/product-images/${product._id}/${product.images[index]._id}`;

app.use("/", authRouter);
app.use("/cart", cartRouter);
app.use("/wishlist", wishlistRouter);
app.use("/checkout", checkoutRouter);
app.use("/orders", ordersRouter);
app.use("/account", accountRouter);
app.use("/assistant", assistantRouter);
app.use("/admin", adminRouter);
app.use("/", index);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
