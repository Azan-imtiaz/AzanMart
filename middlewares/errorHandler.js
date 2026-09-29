const httpError = require("../utils/httpError");

function notFound(req, res, next) {
  next(httpError(404, "We couldn't find the page you were looking for."));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Bad input caught by Mongoose is the client's fault, not ours
  const isBadInput = err.name === "ValidationError" || err.name === "CastError";
  const status = isBadInput ? 400 : err.status || err.statusCode || 500;

  // Never leak internal error details to the browser
  let message = "Something went wrong on our side. Please try again.";
  if (isBadInput) message = "Some of the information sent was not valid.";
  else if (status < 500) message = err.message;

  if (status >= 500) console.error(err);

  res.status(status).render("error", {
    title: status === 404 ? "Page not found" : "Something went wrong",
    status,
    message,
  });
}

module.exports = { notFound, errorHandler };
