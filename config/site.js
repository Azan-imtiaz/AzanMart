// Absolute links are needed for SEO tags, Stripe redirects and emails
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

module.exports = { APP_URL };
