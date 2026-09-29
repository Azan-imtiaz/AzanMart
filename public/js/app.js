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
