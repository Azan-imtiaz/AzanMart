// The AI shopping assistant chat panel
(function () {
  const root = document.querySelector("[data-assistant]");
  if (!root) return;

  const panel = root.querySelector("#assistant-panel");
  const openButton = root.querySelector("[data-assistant-open]");
  const list = root.querySelector("[data-assistant-messages]");
  const form = root.querySelector("[data-assistant-form]");
  const input = form.querySelector("textarea");
  const subtitle = root.querySelector("[data-assistant-subtitle]");
  const STORAGE_KEY = "azanmart-assistant";
  const product = document.querySelector("[data-assistant-product]")?.dataset;

  let csrf = null;
  let busy = false;
  let history = load();

  function load() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }
  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-20)));
    } catch {
      // Not saved; the chat still works on this page
    }
  }

  function suggestions() {
    if (product) {
      return [
        "Will this fit a 15-inch laptop?",
        "What do reviewers say about it?",
        "Is there something similar for less?",
      ];
    }
    const list = [
      "Find me a laptop backpack under $100",
      "What's on sale right now?",
      "Is shipping free?",
    ];
    if (root.dataset.cryptoEnabled === "true") list.push("How do I pay with crypto?");
    return list;
  }

  function bubble(role, text) {
    const row = document.createElement("div");
    row.className = role === "user" ? "flex justify-end" : "flex justify-start";
    const box = document.createElement("div");
    box.className =
      role === "user"
        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-blue-900 px-3.5 py-2 text-sm text-white whitespace-pre-line"
        : "max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm shadow-sm whitespace-pre-line dark:bg-gray-800";
    box.textContent = text; // never HTML: replies are model output
    row.append(box);
    list.append(row);
    return box;
  }

  function productCards(products) {
    if (!products?.length) return;
    const wrap = document.createElement("div");
    wrap.className = "space-y-2 pl-1";
    for (const item of products) {
      const card = document.createElement("a");
      card.href = `/products/${encodeURIComponent(item.slug)}`;
      card.className =
        "flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 hover:border-blue-900 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-400";
      const image = document.createElement("img");
      image.src = item.imageUrl;
      image.alt = "";
      image.className = "h-12 w-12 rounded-lg object-contain";
      image.style.backgroundColor = item.bgcolor;
      const text = document.createElement("span");
      text.className = "min-w-0 flex-1 text-sm";
      const name = document.createElement("span");
      name.className = "block truncate font-medium";
      name.textContent = item.name;
      const price = document.createElement("span");
      price.className = "text-blue-900 dark:text-blue-300";
      price.textContent = item.inStock ? item.price : `${item.price} · sold out`;
      text.append(name, price);
      const arrow = document.createElement("i");
      arrow.className = "ri-arrow-right-s-line muted";
      card.append(image, text, arrow);
      wrap.append(card);
    }
    list.append(wrap);
  }

  function renderWelcome() {
    bubble(
      "assistant",
      product
        ? `Hi! Ask me anything about the ${product.assistantProductName}: size, materials, reviews or delivery.`
        : "Hi! I can help you find the right bag, compare products, or explain shipping and payments.",
    );
    const chips = document.createElement("div");
    chips.className = "flex flex-wrap gap-2 pl-1";
    for (const text of suggestions()) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-900 hover:bg-blue-50 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-200 dark:hover:bg-gray-800";
      chip.textContent = text;
      chip.addEventListener("click", () => ask(text));
      chips.append(chip);
    }
    list.append(chips);
  }

  function render() {
    list.replaceChildren();
    renderWelcome();
    for (const message of history) {
      bubble(message.role, message.content);
      if (message.products) productCards(message.products);
    }
    list.scrollTop = list.scrollHeight;
  }

  function typing() {
    const row = document.createElement("div");
    row.className = "flex justify-start";
    row.innerHTML =
      '<div class="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm dark:bg-gray-800" aria-label="The assistant is typing">' +
      '<span class="h-2 w-2 animate-bounce rounded-full bg-blue-900 dark:bg-blue-300"></span>' +
      '<span class="h-2 w-2 animate-bounce rounded-full bg-blue-900 [animation-delay:150ms] dark:bg-blue-300"></span>' +
      '<span class="h-2 w-2 animate-bounce rounded-full bg-blue-900 [animation-delay:300ms] dark:bg-blue-300"></span></div>';
    list.append(row);
    list.scrollTop = list.scrollHeight;
    return row;
  }

  async function getCsrf() {
    if (!csrf) {
      const res = await fetch("/assistant/session", { headers: { Accept: "application/json" } });
      csrf = (await res.json()).csrf;
    }
    return csrf;
  }

  async function ask(question) {
    const text = question.trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    history.push({ role: "user", content: text });
    save();
    bubble("user", text);
    const indicator = typing();

    try {
      const res = await fetch("/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": await getCsrf() },
        body: JSON.stringify({
          productSlug: product?.assistantProduct || null,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      indicator.remove();
      if (!res.ok) {
        if (res.status === 403) csrf = null; // the session changed (e.g. after logging in); get a new token
        history.pop(); // let the shopper ask again
        save();
        bubble("assistant", data.error || "Something went wrong. Please try again.").classList.add(
          "text-red-700",
          "dark:text-red-300",
        );
      } else {
        history.push({ role: "assistant", content: data.reply, products: data.products });
        save();
        bubble("assistant", data.reply);
        productCards(data.products);
      }
    } catch {
      indicator.remove();
      history.pop();
      save();
      bubble("assistant", "I couldn't connect. Check your internet connection and try again.");
    } finally {
      busy = false;
      list.scrollTop = list.scrollHeight;
      input.focus();
    }
  }

  function open() {
    panel.hidden = false;
    openButton.hidden = true;
    if (product) subtitle.textContent = `Asking about ${product.assistantProductName}`;
    render();
    input.focus();
  }

  function close() {
    panel.hidden = true;
    openButton.hidden = false;
    openButton.focus();
  }

  openButton.addEventListener("click", open);
  root.querySelector("[data-assistant-close]").addEventListener("click", close);
  root.querySelector("[data-assistant-reset]").addEventListener("click", () => {
    history = [];
    save();
    render();
    input.focus();
  });
  document
    .querySelectorAll("[data-assistant-trigger]")
    .forEach((button) => button.addEventListener("click", open));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });
  // Enter sends, Shift+Enter adds a new line
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask(input.value);
    }
  });
})();
