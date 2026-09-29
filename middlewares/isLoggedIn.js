const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

module.exports.isLoggedIn = async function (req, res, next) {
    // Check if token exists in cookies
    if (!req.cookies.token) {
        req.flash("error", "You need to log in first");
        return res.redirect("/");
    }

    try {
        // Verify JWT token (throws if invalid or expired)
        const result = jwt.verify(req.cookies.token, process.env.SECRET_KEY);

        // Fetch user details from database
        const user = await userModel.findOne({ email: result.email }).select("-password");
        if (!user) {
            res.clearCookie("token");
            req.flash("error", "User not found");
            return res.redirect("/");
        }

        // Attach user object to request for further middleware/routes
        req.user = user;
        next();
    } catch (err) {
        res.clearCookie("token");
        req.flash("error", "Your session has expired, please log in again");
        return res.redirect("/");
    }
};
