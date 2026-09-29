const httpError = require("../utils/httpError");

function notFound(req, res, next) {
  next(httpError(404, "We couldn't find the page you were looking for."));
}

function errorHandler(err, req, res, next) {
  // Mongoose validation errors are the client's fault, not ours
  const status = err.name === "ValidationError" ? 400 : err.status || err.statusCode || 500;

  if (status >= 500) console.error(err);
  if (res.headersSent) return;

  res.status(status).render("error", {
    title: status === 404 ? "Page not found" : "Something went wrong",
    status,
    // Never leak internal error details to the browser
    message: status < 500 ? err.message : "Something went wrong on our side. Please try again.",
    loggedIn: false,
  });
}

module.exports = { notFound, errorHandler };
