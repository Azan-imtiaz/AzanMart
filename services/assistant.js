const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const reviewModel = require("../models/reviewModel");
const config = require("../config/assistant");
const cryptoConfig = require("../config/crypto");
const { formatPrice } = require("../utils/money");
const { FREE_SHIPPING_FROM, SHIPPING_FEE } = require("./cart");

// An error from the NVIDIA API, with its HTTP status (0 when it couldn't be reached)
class AssistantApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// One chat completion from NVIDIA's OpenAI-compatible API
async function callNvidia(body) {
  let res;
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err) {
    throw new AssistantApiError(0, err.message);
  }
  if (!res.ok) throw new AssistantApiError(res.status, (await res.text()).slice(0, 200));
  return res.json();
}

// Swapped for a fake in tests
let client = callNvidia;

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
    parameters: {
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
    parameters: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
      additionalProperties: false,
    },
  },
].map((tool) => ({ type: "function", function: tool }));

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

async function searchProducts(input) {
  const query = String(input.query ?? "");
  const category = String(input.category ?? "any");
  const max_price = Number(input.max_price) || 0;
  const on_sale_only = input.on_sale_only === true || input.on_sale_only === "true";
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

  // Page context goes in the latest message, so the system prompt stays the same for every question
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
  messages.unshift({ role: "system", content: SYSTEM_PROMPT });
  for (let round = 0; round <= config.maxToolRounds; round++) {
    const response = await client({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      tools: TOOLS,
      messages,
    });

    const message = response.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];
    if (!toolCalls.length) {
      // Some models show their reasoning in <think> tags; shoppers only see the answer
      const reply = (message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      return {
        reply: reply || "Sorry, I didn't catch that. Could you ask again?",
        products: productCards(reply, seen),
      };
    }

    // Keep the assistant turn so the model sees which tools it called
    messages.push({ role: "assistant", content: message.content || "", tool_calls: toolCalls });
    const results = await Promise.all(
      toolCalls.map(async (call) => {
        let content;
        try {
          content = await runTool(
            call.function.name,
            JSON.parse(call.function.arguments || "{}"),
            seen,
          );
        } catch (err) {
          content = JSON.stringify({ error: `Tool failed: ${err.message}` });
        }
        return { role: "tool", tool_call_id: call.id, content };
      }),
    );
    messages.push(...results);
  }

  return {
    reply: "That took more searching than I can do in one go. Could you narrow it down a little?",
    products: [],
  };
}

module.exports = {
  answer,
  SYSTEM_PROMPT,
  TOOLS,
  AssistantApiError,
  setClient: (fake) => (client = fake),
};
