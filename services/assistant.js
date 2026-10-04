const Anthropic = require("@anthropic-ai/sdk").default;
const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const reviewModel = require("../models/reviewModel");
const config = require("../config/assistant");
const cryptoConfig = require("../config/crypto");
const { formatPrice } = require("../utils/money");
const { FREE_SHIPPING_FROM, SHIPPING_FEE } = require("./cart");

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

// Kept identical between requests so it can be cached
const SYSTEM_PROMPT = `You are the shopping assistant for AzanMart, an online store for bags and everyday essentials.

Help shoppers find products and answer questions about them and about how the store works.

Facts about the store:
- Categories: ${productModel.CATEGORIES.join(", ")}.
- Shipping is free on orders of ${formatPrice(FREE_SHIPPING_FROM)} or more; below that it costs ${formatPrice(SHIPPING_FEE)}.
- Payment options: card (through Stripe), cash on delivery${cryptoConfig.enabled ? `, and USDC from a crypto wallet such as MetaMask on ${cryptoConfig.networkName} (the shopper has 30 minutes to pay)` : ""}.
- Shoppers need a verified email address to place an order. Orders can be tracked under "My orders", which shows the courier and tracking number once an order ships.
- This is a demo store: payments run in test mode and no real money is charged.

How to answer:
- Use the search_products and get_product tools for anything about products. Never invent products, prices, stock levels, features or reviews; if the tools don't say something, say you don't know.
- When you recommend products, use their exact names so the shop can show them as cards under your reply.
- Keep replies short and friendly: two to four sentences of plain text, no markdown, headings or bullet lists.
- You can't place orders, see accounts or change anything. For that, point shoppers to the right page.
- If a question has nothing to do with shopping at AzanMart, briefly say you can only help with the store.`;

const TOOLS = [
  {
    name: "search_products",
    description:
      "Search the AzanMart catalog. Returns up to 6 products with price, discount, stock and rating. Use an empty query to list products in a category or under a price.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search words, e.g. 'laptop backpack'. Empty string for none.",
        },
        category: { type: "string", enum: ["any", ...productModel.CATEGORIES] },
        max_price: {
          type: "number",
          description: "Maximum price in US dollars. 0 means no limit.",
        },
        on_sale_only: { type: "boolean" },
      },
      required: ["query", "category", "max_price", "on_sale_only"],
      additionalProperties: false,
    },
  },
  {
    name: "get_product",
    description: "Get the full description and recent reviews of one product by its slug.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
];

const CARD_FIELDS =
  "name slug category price finalPrice discount stock ratingAverage ratingCount bgcolor images._id";

function describe(product) {
  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    price: formatPrice(product.finalPrice),
    original_price: product.discount > 0 ? formatPrice(product.price) : undefined,
    discount_percent: product.discount || undefined,
    in_stock: product.stock > 0,
    stock_left: product.stock,
    rating: product.ratingCount
      ? `${product.ratingAverage} out of 5 (${product.ratingCount} reviews)`
      : "no reviews yet",
  };
}

async function searchProducts({ query, category, max_price, on_sale_only }) {
  const filter = {};
  if (query.trim()) filter.$text = mongoose.trusted({ $search: query.slice(0, 100) });
  if (category !== "any" && productModel.CATEGORIES.includes(category)) filter.category = category;
  if (max_price > 0) filter.finalPrice = mongoose.trusted({ $lte: Math.round(max_price * 100) });
  if (on_sale_only) filter.discount = mongoose.trusted({ $gt: 0 });

  return productModel
    .find(filter)
    .select(`${CARD_FIELDS} description`)
    .sort(query.trim() ? { score: { $meta: "textScore" } } : { ratingAverage: -1 })
    .limit(6)
    .lean();
}

async function getProduct({ slug }) {
  const product = await productModel
    .findOne({ slug: String(slug) })
    .select(`${CARD_FIELDS} description`)
    .lean();
  if (!product) return null;
  product.reviews = await reviewModel
    .find({ product: product._id })
    .sort({ createdAt: -1 })
    .limit(3)
    .select("rating comment verifiedPurchase")
    .lean();
  return product;
}

// Runs one tool call. Products it returns are remembered so the reply can show them as cards.
async function runTool(name, input, seen) {
  if (name === "search_products") {
    const products = await searchProducts(input);
    products.forEach((product) => seen.set(product.slug, product));
    return JSON.stringify(
      products.length
        ? products.map((product) => ({
            ...describe(product),
            summary: product.description.slice(0, 200),
          }))
        : { message: "No products matched." },
    );
  }
  if (name === "get_product") {
    const product = await getProduct(input);
    if (!product) return JSON.stringify({ message: "No product with that slug." });
    seen.set(product.slug, product);
    return JSON.stringify({
      ...describe(product),
      description: product.description,
      recent_reviews: product.reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        verified_purchase: review.verifiedPurchase,
      })),
    });
  }
  return JSON.stringify({ error: `Unknown tool ${name}` });
}

// Products the reply mentions by name, built from our own data (never from model output)
function productCards(reply, seen) {
  const text = reply.toLowerCase();
  return [...seen.values()]
    .filter((product) => text.includes(product.name.toLowerCase()))
    .slice(0, 3)
    .map((product) => ({
      name: product.name,
      slug: product.slug,
      price: formatPrice(product.finalPrice),
      originalPrice: product.discount > 0 ? formatPrice(product.price) : null,
      imageUrl: `/product-images/${product._id}/${product.images[0]._id}`,
      bgcolor: product.bgcolor,
      inStock: product.stock > 0,
    }));
}

// history: [{ role: "user" | "assistant", content: string }], ending with the
// shopper's new question. productSlug: the product page they're on, if any.
async function answer({ history, productSlug }) {
  const messages = history.map(({ role, content }) => ({ role, content }));

  // Page context goes in the latest message, not the system prompt, so the cached prefix stays the same
  if (productSlug) {
    const product = await productModel
      .findOne({ slug: String(productSlug) })
      .select("name slug")
      .lean();
    if (product) {
      const last = messages[messages.length - 1];
      last.content = `[The shopper is on the product page for "${product.name}" (slug: ${product.slug}).]\n\n${last.content}`;
    }
  }

  const seen = new Map();
  for (let round = 0; round <= config.maxToolRounds; round++) {
    const response = await getClient().beta.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      output_config: { effort: config.effort },
      // If the model declines, the API retries on a suitable fallback model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return {
        reply:
          "Sorry, I can't help with that one. Ask me anything about our products or your order.",
        products: [],
      };
    }

    // Keep the whole assistant turn (including thinking blocks) for the next request
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    const toolCalls = response.content.filter((block) => block.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolCalls.length === 0) {
      const reply = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return {
        reply: reply || "Sorry, I didn't catch that. Could you ask again?",
        products: productCards(reply, seen),
      };
    }

    // All results go back in one message so the model keeps making parallel calls
    const results = await Promise.all(
      toolCalls.map(async (call) => {
        try {
          return {
            type: "tool_result",
            tool_use_id: call.id,
            content: await runTool(call.name, call.input, seen),
          };
        } catch (err) {
          return {
            type: "tool_result",
            tool_use_id: call.id,
            content: `Tool failed: ${err.message}`,
            is_error: true,
          };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "That took more searching than I can do in one go. Could you narrow it down a little?",
    products: [],
  };
}

module.exports = { answer, SYSTEM_PROMPT, TOOLS, setClient: (fake) => (client = fake) };
