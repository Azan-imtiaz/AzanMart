const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const adminRouter = require("./routes/adminRouter");
const authRouter = require("./routes/authRouter");
const cartRouter = require("./routes/cartRouter");
const wishlistRouter = require("./routes/wishlistRouter");
const index = require("./routes/index");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const flash = require("./middlewares/flash");
const { loadUser } = require("./middlewares/auth");
const csrf = require("./middlewares/csrf");
const { formatPrice } = require("./utils/money");
const { sendProductImage } = require("./controllers/imageController");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;
// Open Graph and canonical links need absolute URLs
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
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

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(isProduction ? "combined" : "dev"));
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "https://cdn.jsdelivr.net"],
        // Product colours come from the database as inline style attributes
        "style-src-attr": ["'unsafe-inline'"],
        "font-src": ["'self'", "https://cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:"],
        "form-action": ["'self'"],
        // Only force HTTPS in production, otherwise localhost breaks
        "upgrade-insecure-requests": isProduction ? [] : null,
      },
    },
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
app.use(express.static(path.join(__dirname, "public")));
app.get("/product-images/:productId/:imageId", sendProductImage);

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
      clientPromise: mongoose.connection.asPromise().then((conn) => conn.getClient()),
      ttl: SESSION_TTL_DAYS * 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(flash);
app.use(loadUser);
app.use(csrf);

app.set("view engine", "ejs");
app.locals.formatPrice = formatPrice;
app.locals.imageUrl = (product, index = 0) =>
  `/product-images/${product._id}/${product.images[index]._id}`;

app.use("/", authRouter);
app.use("/cart", cartRouter);
app.use("/wishlist", wishlistRouter);
app.use("/admin", adminRouter);
app.use("/", index);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
