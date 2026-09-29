document.querySelectorAll("[data-toast]").forEach((toast) => {
  const close = () => toast.remove();
  toast.querySelector("[data-toast-close]")?.addEventListener("click", close);
  setTimeout(close, 4000);
});
