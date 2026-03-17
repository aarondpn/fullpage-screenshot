// Synchronous theme flash prevention — must run before page renders.
// Uses localStorage as a sync cache (browser.storage.local is async).
(function () {
  var c = localStorage.getItem("theme-cache");
  if (c === "dark" || (c !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  }
})();
