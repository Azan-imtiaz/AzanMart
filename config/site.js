// Absolute links are needed for SEO tags, Stripe redirects and emails
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

// Appended to static asset URLs so browsers can cache them for a long time
// and still pick up new files after a deploy
const ASSET_VERSION = (process.env.RENDER_GIT_COMMIT || Date.now().toString(36)).slice(0, 8);

// A public demo: shows a banner and test payment details. Turn off with DEMO_MODE=false.
const DEMO_MODE = process.env.DEMO_MODE !== "false";

module.exports = { APP_URL, ASSET_VERSION, DEMO_MODE };
