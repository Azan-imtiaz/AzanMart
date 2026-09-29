const { validationResult } = require("express-validator");

// Runs the validation rules, then sends the user back to the form
// with the first error message if anything failed. redirectTo can be
// a path or a function of the request.
function validate(rules, redirectTo) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (errors.isEmpty()) return next();

      req.flash("error", errors.array()[0].msg);
      res.redirect(typeof redirectTo === "function" ? redirectTo(req) : redirectTo);
    },
  ];
}

module.exports = validate;
