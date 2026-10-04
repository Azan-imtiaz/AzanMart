const productModel = require("../models/productModel");
const { APP_URL } = require("../config/site");

const PRIVATE_PATHS = ["/admin", "/account", "/cart", "/checkout", "/orders", "/wishlist"];

exports.robots = (req, res) => {
  const lines = [
    "User-agent: *",
    ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${APP_URL}/sitemap.xml`,
  ];
  res.type("text/plain").send(lines.join("\n"));
};

const escapeXml = (text) => String(text).replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);

// Built from the live catalog so new products are discoverable straight away
exports.sitemap = async (req, res) => {
  const products = await productModel.find().select("slug updatedAt").lean();

  const pages = [
    { loc: "/", priority: "1.0" },
    { loc: "/shop", priority: "0.9" },
    ...productModel.CATEGORIES.map((category) => ({
      loc: `/shop?category=${encodeURIComponent(category)}`,
      priority: "0.7",
    })),
    ...products.map((product) => ({
      loc: `/products/${product.slug}`,
      lastmod: product.updatedAt?.toISOString().slice(0, 10),
      priority: "0.8",
    })),
    { loc: "/features", priority: "0.6" },
    { loc: "/guide", priority: "0.5" },
    { loc: "/about", priority: "0.3" },
  ];

  const urls = pages
    .map(
      ({ loc, lastmod, priority }) =>
        `  <url><loc>${escapeXml(APP_URL + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${priority}</priority></url>`,
    )
    .join("\n");

  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=3600")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    );
};
