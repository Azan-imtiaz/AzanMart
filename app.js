const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const expressSession = require("express-session");
const flash = require("connect-flash");

const ownersRouter = require("./routes/ownersRouter");
const productsRouter = require("./routes/productsRouter");
const usersRouter = require("./routes/usersRouter");
const index = require("./routes/index");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;
// Open Graph and canonical links need absolute URLs
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

app.disable("x-powered-by");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  expressSession({
    resave: false,
    saveUninitialized: false,
    secret: process.env.EXP_SESSION_SECRET,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    },
  }),
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.appUrl = APP_URL;
  res.locals.currentPath = req.path;
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

app.use("/owners", ownersRouter);
app.use("/users", usersRouter);
app.use("/products", productsRouter);
app.use("/", index);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
