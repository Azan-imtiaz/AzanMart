document.querySelectorAll("[data-toast]").forEach((toast) => {
  const close = () => toast.remove();
  toast.querySelector("[data-toast-close]")?.addEventListener("click", close);
  setTimeout(close, 4000);
});

// Close dropdown menus when clicking anywhere else
document.addEventListener("click", (event) => {
  document.querySelectorAll("details[data-menu][open]").forEach((menu) => {
    if (!menu.contains(event.target)) menu.removeAttribute("open");
  });
});

// Sort dropdowns and cart quantities apply as soon as they change
document.querySelectorAll("form[data-autosubmit] :is(select, input)").forEach((field) => {
  field.addEventListener("change", () => field.form.submit());
});

// Product gallery: clicking a thumbnail swaps the main image
const galleryMain = document.querySelector("[data-gallery-main]");
document.querySelectorAll("[data-gallery-thumb]").forEach((thumb, _, thumbs) => {
  thumb.addEventListener("click", () => {
    galleryMain.src = thumb.dataset.galleryThumb;
    thumbs.forEach((other) => other.classList.replace("border-blue-900", "border-transparent"));
    thumb.classList.replace("border-transparent", "border-blue-900");
  });
});

// Ask before destructive actions like deleting a product
document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

// Dark mode toggle; the choice is remembered, otherwise the system setting wins
document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Not saved, but the toggle still works for this page
    }
    document.dispatchEvent(new CustomEvent("themechange"));
  });
});

// Shop filters are collapsible on phones but always open on wide screens
const filters = document.querySelector("details[data-filters]");
if (filters && window.matchMedia("(min-width: 1024px)").matches) filters.open = true;

// Copy buttons, e.g. the wallet address and amount on the crypto payment page
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      const label = button.querySelector("[data-copy-label]");
      if (label) {
        const original = label.textContent;
        label.textContent = "Copied";
        setTimeout(() => (label.textContent = original), 1500);
      }
    } catch {
      // Clipboard access can be blocked; the value is still visible to copy by hand
    }
  });
});

// Dismissing the demo banner is remembered on this device
document.querySelector("[data-dismiss-banner]")?.addEventListener("click", () => {
  document.documentElement.classList.add("demo-banner-dismissed");
  try {
    localStorage.setItem("demo-banner-dismissed", "1");
  } catch {
    // Hidden for this page only
  }
});
