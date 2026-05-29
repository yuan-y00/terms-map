/*
 * 术语地图 — Theme Manager
 * ============================================================================
 * 管理 light/dark 主题切换。
 * - 首次访问读取 prefers-color-scheme
 * - 用户切换后保存到 localStorage
 * - 切换时更新 document.documentElement 的 data-theme 属性
 */
const Theme = (() => {
  const STORAGE_KEY = "ema-wiki-theme";
  const ATTR = "data-theme";

  /* Resolve initial theme */
  function resolve() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  /* Apply theme to DOM */
  function apply(theme) {
    document.documentElement.setAttribute(ATTR, theme);
  }

  /* Toggle between light and dark */
  function toggle() {
    const current = document.documentElement.getAttribute(ATTR) || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    updateButtonLabel(next);
    return next;
  }

  /* Set a specific theme */
  function set(theme) {
    if (theme !== "light" && theme !== "dark") return;
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
    updateButtonLabel(theme);
  }

  /* Update the toggle button text */
  function updateButtonLabel(theme) {
    const btn = document.getElementById("btn-theme");
    if (!btn) return;
    btn.textContent = theme === "dark" ? "☀" : "☽";
    btn.setAttribute("title", theme === "dark" ? "Switch to Light" : "Switch to Dark");
  }

  /* Initialize */
  function init() {
    const theme = resolve();
    apply(theme);
    updateButtonLabel(theme);

    const btn = document.getElementById("btn-theme");
    if (btn) {
      btn.addEventListener("click", toggle);
    }
  }

  return { init, toggle, set, resolve };
})();
