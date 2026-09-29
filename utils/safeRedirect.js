// Only allow redirects back into this site, never to another domain
function safeRedirect(url, fallback = "/") {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : fallback;
}

module.exports = safeRedirect;
