const jwt = require("jsonwebtoken");
const ownerModel = require("../models/ownerModel");

module.exports.isOwner = async function (req, res, next) {
    if (!req.cookies.ownerToken) {
        req.flash("error", "Owner login required");
        return res.redirect("/owners/login");
    }

    try {
        const result = jwt.verify(req.cookies.ownerToken, process.env.SECRET_KEY);
        if (result.role !== "owner") {
            throw new Error("Not an owner token");
        }

        const owner = await ownerModel.findOne({ email: result.email }).select("-password");
        if (!owner) {
            throw new Error("Owner not found");
        }

        req.owner = owner;
        next();
    } catch {
        res.clearCookie("ownerToken");
        req.flash("error", "Owner login required");
        return res.redirect("/owners/login");
    }
};
