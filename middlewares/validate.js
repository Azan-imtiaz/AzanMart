const { validationResult } = require("express-validator");

// Runs the validation rules, then sends the user back to the form
// with the first error message if anything failed.
function validate(rules, redirectTo) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (errors.isEmpty()) return next();

      req.flash("error", errors.array()[0].msg);
      res.redirect(redirectTo);
    },
  ];
}

module.exports = validate;
