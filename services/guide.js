const fs = require("fs/promises");
const path = require("path");
const { Marked } = require("marked");

const GUIDE_FILE = path.join(__dirname, "../docs/USER_GUIDE.md");
const REPO_URL = "https://github.com/Azan-imtiaz/AzanMart/blob/main";

// Same anchors GitHub generates, so links written for GitHub work here too
function headingId(text, used) {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/ /g, "-");
  const count = used.get(base) || 0;
  used.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

// Links in the guide are written for GitHub; point them at the right place in the app
function rewriteHref(href) {
  if (href.startsWith("screenshots/")) return `/guide/${href}`;
  if (href.startsWith("../README.md")) return `${REPO_URL}/README.md${href.slice(12)}`;
  if (/^[A-Z_]+\.md/.test(href)) return `${REPO_URL}/docs/${href}`;
  return href;
}

async function renderGuide() {
  const markdown = await fs.readFile(GUIDE_FILE, "utf8");
  const used = new Map();
  const toc = [];

  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = headingId(text, used);
        const html = this.parser.parseInline(tokens);
        if (depth === 2 || depth === 3) toc.push({ id, depth, text: html.replace(/<[^>]+>/g, "") });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const url = rewriteHref(href);
        const external = /^https?:/.test(url);
        return `<a href="${url}"${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        return `<img src="${rewriteHref(href)}" alt="${text}" loading="lazy">`;
      },
    },
  });

  // The page has its own table of contents, so drop the title and the guide's link list
  const tokens = marked.lexer(markdown);
  const title = tokens.find((token) => token.type === "heading" && token.depth === 1);
  const linkList = tokens.find((token) => token.type === "list");
  const body = tokens.filter((token) => token !== title && token !== linkList);
  body.links = tokens.links;

  return { title: title?.text || "User guide", html: marked.parser(body), toc };
}

// Rendered once in production; on every request in development so edits show up
let cached;
function getGuide() {
  if (process.env.NODE_ENV !== "production") return renderGuide();
  cached ??= renderGuide();
  return cached;
}

module.exports = { getGuide, headingId };
