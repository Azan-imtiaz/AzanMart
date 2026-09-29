const express = require("express");
const { isOwner } = require("../middlewares/isOwner");
const owner = require("../controllers/ownerController");

const router = express.Router();

if (process.env.NODE_ENV === "development") {
  router.post("/create", owner.createOwner);
}

router.get("/login", owner.showLogin);
router.post("/login", owner.login);
router.get("/logout", owner.logout);
router.get("/admin", isOwner, owner.showAdmin);

module.exports = router;
