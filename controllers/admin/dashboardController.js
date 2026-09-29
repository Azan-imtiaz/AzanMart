const mongoose = require("mongoose");
const orderModel = require("../../models/orderModel");
const productModel = require("../../models/productModel");
const userModel = require("../../models/userModel");

exports.showDashboard = async (req, res) => {
  const [revenue, orderCount, customerCount, productCount, lowStock, recentOrders] =
    await Promise.all([
      orderModel.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      orderModel.countDocuments(),
      userModel.countDocuments({ role: "customer" }),
      productModel.countDocuments(),
      productModel
        .find({ stock: mongoose.trusted({ $lte: 5 }) })
        .select("name slug stock")
        .sort({ stock: 1 })
        .limit(5)
        .lean(),
      orderModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber total status createdAt shippingAddress.fullName")
        .lean(),
    ]);

  res.render("admin/dashboard", {
    title: "Dashboard",
    stats: {
      revenue: revenue[0]?.total || 0,
      orderCount,
      customerCount,
      productCount,
    },
    lowStock,
    recentOrders,
  });
};
