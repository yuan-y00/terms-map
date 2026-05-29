/*
 * 术语地图 — Client-side Full-Text Search Engine
 * ============================================================================
 * Round 5 — 基于 search.json 的客户端全文搜索。
 * - 纯客户端搜索，无后端、无数据库
 * - 支持中英文混合分词
 * - 多字段加权打分
 * - 命中词高亮
 * - 摘要提取
 */
window.SearchEngine = (function () {

  /* ------------------------------------------------------------------------
   * normalizeQuery — 规范化用户查询
   *   - trim
   *   - 转小写
   *   - 全角空格转半角
   *   - 多个空白压缩成一个空格
   * ------------------------------------------------------------------------ */
  function normalizeQuery(query) {
    if (!query || typeof query !== "string") return "";
    return query
      .trim()
      .toLowerCase()
      .replace(/　/g, " ")
      .replace(/[\s]+/g, " ")
      .trim();
  }

  /* ------------------------------------------------------------------------
   * tokenize — 将查询拆分为关键词数组
   *   - 英文按空格拆分
   *   - 中文连续字符串保留整体
   *   - 去重、过滤空 token
   * ------------------------------------------------------------------------ */
  function tokenize(query) {
    if (!query) return [];
    var parts = query.split(/[\s]+/);
    var seen = {};
    var tokens = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (seen[part]) continue;
      seen[part] = true;
      tokens.push(part);
    }
    return tokens;
  }

  /* ------------------------------------------------------------------------
   * fieldContains — 检查字段是否包含指定 token（大小写不敏感）
   *   支持 string 和 string[]
   * ------------------------------------------------------------------------ */
  function fieldContains(fieldValue, token) {
    if (!fieldValue) return false;
    if (typeof fieldValue === "string") {
      return fieldValue.toLowerCase().indexOf(token) !== -1;
    }
    if (Array.isArray(fieldValue)) {
      for (var i = 0; i < fieldValue.length; i++) {
        if (String(fieldValue[i]).toLowerCase().indexOf(token) !== -1) {
          return true;
        }
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------------
   * FIELD_WEIGHTS — 各字段搜索权重
   * ------------------------------------------------------------------------ */
  var FIELD_WEIGHTS = {
    title: 12,
    tags: 8,
    summary: 5,
    headings: 4,
    category: 3,
    text: 1,
  };

  /* ------------------------------------------------------------------------
   * search — 主搜索函数
   *
   *   参数:
   *     index   — search.json 解析后的对象 (包含 .items 数组)
   *     query   — 用户查询字符串
   *     options — { lang, category, limit }
   *
   *   返回: 匹配结果数组，按 score 降序
   * ------------------------------------------------------------------------ */
  function search(index, query, options) {
    if (!index || !index.items || !index.items.length) return [];

    var opts = options || {};
    var lang = opts.lang || "zh";
    var category = opts.category || null;
    var limit = opts.limit || 50;

    var tokens = tokenize(normalizeQuery(query));
    if (!tokens.length) return [];

    var results = [];

    for (var i = 0; i < index.items.length; i++) {
      var item = index.items[i];

      /* Language filter */
      if (item.lang !== lang) continue;

      /* Category filter */
      if (category && item.category !== category) continue;

      var score = 0;
      var matchedFields = [];

      for (var t = 0; t < tokens.length; t++) {
        var token = tokens[t];

        if (fieldContains(item.title, token)) {
          score += FIELD_WEIGHTS.title;
          if (matchedFields.indexOf("title") === -1) matchedFields.push("title");
        }
        if (fieldContains(item.tags, token)) {
          score += FIELD_WEIGHTS.tags;
          if (matchedFields.indexOf("tags") === -1) matchedFields.push("tags");
        }
        if (fieldContains(item.summary, token)) {
          score += FIELD_WEIGHTS.summary;
          if (matchedFields.indexOf("summary") === -1) matchedFields.push("summary");
        }
        if (fieldContains(item.headings, token)) {
          score += FIELD_WEIGHTS.headings;
          if (matchedFields.indexOf("headings") === -1) matchedFields.push("headings");
        }
        if (fieldContains(item.category, token)) {
          score += FIELD_WEIGHTS.category;
          if (matchedFields.indexOf("category") === -1) matchedFields.push("category");
        }
        if (fieldContains(item.text, token)) {
          score += FIELD_WEIGHTS.text;
          if (matchedFields.indexOf("text") === -1) matchedFields.push("text");
        }
      }

      if (score > 0) {
        results.push({
          id: item.id,
          title: item.title,
          lang: item.lang,
          category: item.category,
          tags: item.tags || [],
          summary: item.summary || "",
          path: item.path,
          route: item.route,
          score: score,
          matchedFields: matchedFields,
          snippet: extractSnippet(item, tokens),
        });
      }
    }

    /* Sort by score descending, then by title alphabetically */
    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });

    /* Limit results */
    if (results.length > limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /* ------------------------------------------------------------------------
   * extractSnippet — 从文档摘要或正文中提取搜索片段
   *
   *   优先使用 summary。如果 summary 未命中则从 text 中提取第一个命中
   *   token 附近的上下文（约 200 字符）。
   * ------------------------------------------------------------------------ */
  function extractSnippet(item, tokens) {
    if (!tokens || !tokens.length) {
      return (item.summary || "").substring(0, 200);
    }

    /* Try summary first */
    if (item.summary) {
      var lowerSummary = item.summary.toLowerCase();
      for (var i = 0; i < tokens.length; i++) {
        if (lowerSummary.indexOf(tokens[i]) !== -1) {
          return item.summary;
        }
      }
    }

    /* Fall back to text body */
    if (item.text) {
      var text = item.text;
      var lowerText = text.toLowerCase();
      var firstPos = -1;

      for (var j = 0; j < tokens.length; j++) {
        var pos = lowerText.indexOf(tokens[j]);
        if (pos !== -1 && (firstPos === -1 || pos < firstPos)) {
          firstPos = pos;
        }
      }

      if (firstPos !== -1) {
        var start = Math.max(0, firstPos - 80);
        var end = Math.min(text.length, firstPos + 160);
        var snippet = text.substring(start, end);
        if (start > 0) snippet = "…" + snippet;
        if (end < text.length) snippet = snippet + "…";
        return snippet;
      }
    }

    return item.summary || "";
  }

  /* ------------------------------------------------------------------------
   * escapeHtml — HTML 实体转义（防止 XSS）
   * ------------------------------------------------------------------------ */
  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------------------
   * highlight — 安全高亮命中词
   *
   *   1. 先完整 escape HTML
   *   2. 再对每个 token 用大小写不敏感正则包裹 <mark>
   *   3. 不在 escaped 文本上做任何破坏性操作
   * ------------------------------------------------------------------------ */
  function highlight(text, tokens) {
    if (!text) return "";
    var escaped = escapeHtml(text);
    if (!tokens || !tokens.length) return escaped;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      /* Escape regex special characters in token */
      var escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var regex = new RegExp("(" + escapedToken + ")", "gi");
      escaped = escaped.replace(regex, "<mark>$1</mark>");
    }

    return escaped;
  }

  /* ------------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------------ */
  return {
    normalizeQuery: normalizeQuery,
    tokenize: tokenize,
    search: search,
    extractSnippet: extractSnippet,
    highlight: highlight,
  };
})();
