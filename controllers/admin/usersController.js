const mongoose = require("mongoose");
const userModel = require("../../models/userModel");
const orderModel = require("../../models/orderModel");
const httpError = require("../../utils/httpError");
const { ensureDB } = require("../../config/db");

const PAGE_SIZE = 25;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.listUsers = async (req, res) => {
  await ensureDB();
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pattern = mongoose.trusted({ $regex: escapeRegex(q), $options: "i" });
  const filter = q ? { $or: [{ fullName: pattern }, { email: pattern }] } : {};

  const [users, total] = await Promise.all([
    userModel
      .find(filter)
      .select("fullName email role createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    userModel.countDocuments(filter),
  ]);

  // One aggregate for the whole page instead of a query per user
  const orderStats = await orderModel.aggregate([
    { $match: { user: { $in: users.map((user) => user._id) }, status: { $ne: "cancelled" } } },
    { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
  ]);
  const statsByUser = new Map(orderStats.map((stat) => [String(stat._id), stat]));

  res.render("admin/users", {
    title: "Users",
    users: users.map((user) => ({ ...user, stats: statsByUser.get(String(user._id)) })),
    q,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
};

exports.changeRole = async (req, res) => {
  await ensureDB();
  const { id } = req.params;
  const role = req.body.role === "admin" ? "admin" : "customer";
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "User not found");

  // Stops an admin from accidentally locking themselves out
  if (req.user._id.equals(id)) {
    req.flash("error", "You can't change your own role");
    return res.redirect("/admin/users");
  }

  const user = await userModel.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) throw httpError(404, "User not found");

  req.flash("success", `${user.fullName} is now ${role === "admin" ? "an admin" : "a customer"}`);
  res.redirect("/admin/users");
};
