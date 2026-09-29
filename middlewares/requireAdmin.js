const httpError = require("../utils/httpError");

// Must run after isLoggedIn, which sets req.user
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(httpError(403, "You don't have access to this page."));
  }
  next();
}

module.exports = requireAdmin;
