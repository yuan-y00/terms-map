/*
 * 术语地图 — Data API
 * ============================================================================
 * 从内容仓库加载 JSON 和 Markdown 数据。
 * - 支持本地开发模式（相对路径）和远程模式（GitHub Raw URL）
 * - 内存缓存避免重复请求
 * - 清晰的错误信息用于页面展示
 */
const Api = (() => {
  /* Text cache: url → response text */
  const _cache = new Map();

  /* ------------------------------------------------------------------------
   * contentUrl — 将相对路径转为完整 URL
   *
   *   contentUrl('/dist/docs.json')
   *   → 'http://localhost:8080/ema-wiki-content/dist/docs.json'  (本地)
   *   → 'https://raw.githubusercontent.com/.../main/dist/docs.json' (远程)
   *
   *   如果 path 已经是 http/https URL，则原样返回。
   * ------------------------------------------------------------------------ */
  function contentUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const base = CONFIG.contentBase.replace(/\/+$/, "");
    const p = path.replace(/^\/+/, "");
    return base + "/" + p;
  }

  /* ------------------------------------------------------------------------
   * fetchText — 加载文本内容（带缓存）
   *
   *   options.noCache = true  跳过缓存强制重新请求
   * ------------------------------------------------------------------------ */
  async function fetchText(path, options) {
    const url = contentUrl(path);
    const opts = options || {};

    if (!opts.noCache && _cache.has(url)) {
      return _cache.get(url);
    }

    let response;
    try {
      response = await fetch(url, { cache: opts.noCache ? "reload" : "no-store" });
    } catch (netErr) {
      throw new Error(
        "Network request failed: " + url + "\n" +
        "Reason: " + (netErr.message || "Unknown network error") + "\n" +
        "Hint: Make sure you started the server from D:\\Yuan\\ema-wiki (python -m http.server 8080)"
      );
    }

    if (!response.ok) {
      throw new Error(
        "HTTP " + response.status + " " + response.statusText + "\n" +
        "URL: " + url
      );
    }

    const text = await response.text();
    _cache.set(url, text);
    return text;
  }

  /* ------------------------------------------------------------------------
   * fetchJson — 加载并解析 JSON
   * ------------------------------------------------------------------------ */
  async function fetchJson(path, options) {
    const text = await fetchText(path, options);
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(
        "Failed to parse JSON from: " + contentUrl(path) + "\n" +
        "Parse error: " + err.message
      );
    }
  }

  /* ------------------------------------------------------------------------
   * loadSearchIndex — 加载全文搜索索引
   * ------------------------------------------------------------------------ */
  function loadSearchIndex() {
    var endpoint = (CONFIG.endpoints && CONFIG.endpoints.search) || "/dist/search.json";
    return fetchJson(endpoint);
  }

  /* ------------------------------------------------------------------------
   * 便捷加载方法
   * ------------------------------------------------------------------------ */
  function loadDocsManifest() {
    return fetchJson(CONFIG.endpoints.docs);
  }

  function loadSiteConfig() {
    return fetchJson(CONFIG.endpoints.site);
  }

  function loadHomeData(lang) {
    return fetchJson(CONFIG.endpoints.home(lang));
  }

  function loadResources() {
    var endpoint = (CONFIG.endpoints && CONFIG.endpoints.resources) || "/dist/resources.json";
    return fetchJson(endpoint);
  }

  /* ------------------------------------------------------------------------
   * loadMarkdown — 加载文档 Markdown 原文
   *
   *   doc 是 docs.json 中的一条文档记录，包含 path 字段。
   * ------------------------------------------------------------------------ */
  function loadMarkdown(doc) {
    if (!doc || !doc.path) {
      throw new Error("Invalid doc: missing path");
    }
    return fetchText(doc.path, { noCache: true });
  }

  /* ------------------------------------------------------------------------
   * clearApiCache — 清空内存缓存（调试用）
   * ------------------------------------------------------------------------ */
  function clearApiCache() {
    _cache.clear();
  }

  return {
    contentUrl,
    fetchText,
    fetchJson,
    loadDocsManifest,
    loadSiteConfig,
    loadSearchIndex,
    loadHomeData,
    loadResources,
    loadMarkdown,
    clearApiCache,
  };
})();
