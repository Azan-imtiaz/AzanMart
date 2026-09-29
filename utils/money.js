// Prices are stored as integer cents so totals never hit floating point errors
const CURRENCY = "usd";

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY });

const formatPrice = (cents) => formatter.format(cents / 100);
const toCents = (amount) => Math.round(Number(amount) * 100);

module.exports = { CURRENCY, formatPrice, toCents };
