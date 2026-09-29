// Small replacement for connect-flash: messages wait in the session
// until the next page that renders them.
function flash(req, res, next) {
  req.flash = (type, message) => {
    req.session.flash = [...(req.session.flash || []), { type, message }];
  };

  res.locals.takeFlash = () => {
    const messages = req.session.flash || [];
    delete req.session.flash;
    return messages;
  };

  next();
}

module.exports = flash;
