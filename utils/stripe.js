const Stripe = require("stripe");

// Card payments are optional: without a key the store only offers cash on delivery
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

module.exports = { stripe };
