// Runs in <head> before the page paints, so dark mode users never see a white flash
(function () {
  let saved = null;
  try {
    saved = localStorage.getItem("theme");
  } catch {
    // Storage can be blocked (private mode); fall back to the system setting
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", saved ? saved === "dark" : prefersDark);
})();
