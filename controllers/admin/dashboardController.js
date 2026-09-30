const mongoose = require("mongoose");
const orderModel = require("../../models/orderModel");
const productModel = require("../../models/productModel");
const userModel = require("../../models/userModel");

const CHART_DAYS = 30;

// Revenue per day (paid orders), best sellers and orders per status
async function getChartData() {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (CHART_DAYS - 1));

  const [daily, topProducts, statusCounts] = await Promise.all([
    orderModel.aggregate([
      { $match: { paymentStatus: "paid", paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          revenue: { $sum: "$total" },
        },
      },
    ]),
    orderModel.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", units: { $sum: "$items.quantity" } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
    orderModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  // Days without sales still need a point so the line doesn't skip them
  const revenueByDay = new Map(daily.map((day) => [day._id, day.revenue]));
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = new Date(since);
    date.setUTCDate(since.getUTCDate() + i);
    return date.toISOString().slice(0, 10);
  });
  const countByStatus = new Map(statusCounts.map((row) => [row._id, row.count]));

  return {
    revenue: days.map((day) => ({ day, amount: (revenueByDay.get(day) || 0) / 100 })),
    topProducts: topProducts.map((row) => ({ name: row._id, units: row.units })),
    statuses: orderModel.STATUSES.map((status) => ({
      status,
      count: countByStatus.get(status) || 0,
    })),
  };
}

exports.showDashboard = async (req, res) => {
  const [revenue, orderCount, customerCount, productCount, lowStock, recentOrders, charts] =
    await Promise.all([
      orderModel.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      orderModel.countDocuments(),
      // Accounts from before roles existed have no role field, so count "not admin"
      userModel.countDocuments({ role: mongoose.trusted({ $ne: "admin" }) }),
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
      getChartData(),
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
    charts,
  });
};
