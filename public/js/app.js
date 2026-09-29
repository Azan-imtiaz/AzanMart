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

// Sort dropdowns apply as soon as they change
document.querySelectorAll("form[data-autosubmit] select").forEach((select) => {
  select.addEventListener("change", () => select.form.submit());
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
