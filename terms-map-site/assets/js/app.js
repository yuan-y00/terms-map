/*
 * 术语地图 — Application
 * ============================================================================
 * Round 3 — 数据加载。
 * - 从内容仓库加载 JSON 和 Markdown
 * - Hash 路由：#/ (首页)、#/doc/<id> (文档页)、其他 (占位)
 * - 动态侧边栏
 * - 语言切换
 */
const App = (() => {
  /* ------------------------------------------------------------------------
   * Application State
   * ------------------------------------------------------------------------ */
  const state = {
    lang: "zh",
    docsManifest: null,
    siteConfig: null,
    homeData: null,
    resourcesData: null,
    currentDocId: null,
    isReady: false,
    /* Round 5 — search */
    searchIndex: null,
    searchLoading: false,
    searchError: null,
    /* Round 6 — category / TOC */
    currentCategory: null,
  };

  /* Round 6 — TOC IntersectionObserver */
  var tocObserver = null;

  /* Legacy category aliases — redirect to current resource tracks */
  var CATEGORY_ALIASES = {
    "#/elektrotechnik": "electronics",
    "#/mechatronik": "physics",
    "#/automatisierung": "programming",
    "#/career": "",
    "#/foundation": "",
  };

  /* Alias */
  const $t = function (k) { return I18n.t(k); };

  /* ------------------------------------------------------------------------
   * Utility — basic HTML escaping
   * ------------------------------------------------------------------------ */
  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------------------
   * DOM helpers
   * ------------------------------------------------------------------------ */
  function main() {
    return document.getElementById("main-content");
  }

  function setMain(html) {
    var m = main();
    if (m) m.innerHTML = html;
  }

  function safeClassName(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  }

  /* ------------------------------------------------------------------------
   * Render: Loading
   * ------------------------------------------------------------------------ */
  function renderLoading() {
    setMain(
      '<div class="loading-block">' +
        '<div class="loading-spinner"></div>' +
        '<p class="loading-text">' + esc($t("loading")) + "</p>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
   * Render: Error Card
   * ------------------------------------------------------------------------ */
  function renderError(err) {
    setMain(
      '<div class="error-card">' +
        '<div class="error-icon">!</div>' +
        "<h3>" + esc($t("error_title")) + "</h3>" +
        "<pre class=\"error-detail\">" + esc(err.message || String(err)) + "</pre>" +
        '<ul class="error-hints">' +
          "<li>" + esc($t("error_hint_server")) + "</li>" +
          "<li>" + esc($t("error_hint_dist")) + "</li>" +
          "<li>" + esc($t("error_hint_config")) + "</li>" +
        "</ul>" +
        '<button class="btn" onclick="App.retry()">' +
          esc($t("error_retry")) +
        "</button>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
   * Render: Table of Contents
   * ------------------------------------------------------------------------ */
  function renderToc(toc) {
    cleanupTocSpy();

    var tocEl = document.getElementById("toc");
    if (!tocEl) return;

    var title = $t("toc_title");

    if (!toc || toc.length === 0) {
      tocEl.innerHTML =
        "<h4>" + esc(title) + "</h4>" +
        '<p class="toc-empty">' + esc($t("toc_empty")) + "</p>";
      return;
    }

    var h = "<h4>" + esc(title) + "</h4><ul class=\"toc-list\">";
    for (var i = 0; i < toc.length; i++) {
      var item = toc[i];
      var cls = "toc-item toc-level-" + item.level;
      h += '<li class="' + cls + '">' +
        '<a class="toc-link" href="javascript:void(0)" data-toc-id="' + esc(item.id) + '">' +
          esc(item.text) +
        "</a>" +
      "</li>";
    }
    h += "</ul>";

    tocEl.innerHTML = h;

    /* Attach click handlers */
    var links = tocEl.querySelectorAll("[data-toc-id]");
    for (var li = 0; li < links.length; li++) {
      links[li].addEventListener("click", function (e) {
        e.preventDefault();
        var id = this.getAttribute("data-toc-id");
        var el = document.getElementById(id);
        if (el) {
          scrollToAnchorTarget(el);
        }
      });
    }

    /* Setup scroll spy */
    setupTocSpy();
  }

  /* ------------------------------------------------------------------------
   * Render: Home Page — from home.<lang>.json
   * ------------------------------------------------------------------------ */
  function renderHome() {
    var data = state.homeData;
    if (!data) { renderError(new Error("Home data not loaded")); return; }

    var h = '<div class="home-page">';

    /* Hero */
    h += '<section class="home-hero">' +
      '<h1 class="home-hero-title">' + esc(data.hero.title) + '</h1>' +
    '</section>';

    h += '<section class="home-terms-entry" id="home-terms">' +
      '<div class="home-terms-entry-copy">' +
        '<span class="home-terms-kicker">' + esc($t("terms_entry_kicker")) + '</span>' +
        '<h2>' + esc($t("terms_entry_title")) + '</h2>' +
        '<p>' + esc($t("terms_entry_desc")) + '</p>' +
      '</div>' +
      '<a class="btn home-terms-entry-action" href="#/doc/zh-engineering-terms-map">' +
        esc($t("terms_entry_action")) +
      '</a>' +
    '</section>';

    /* ===== Resources ===== */
    if (state.resourcesData) {
      h += ResourceCards.renderHomeResourceSections(state.resourcesData, state.lang);
    }

    h += '</div>'; /* /.home-page */

    setMain(h);

    /* Scroll to anchor if present in hash */
    var hash = window.location.hash;
    if (hash && hash.indexOf('#') === 0 && hash.indexOf('#/') !== 0) {
      setTimeout(function () {
        var el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  function bindHomeAnchors() {
    var links = document.querySelectorAll("[data-home-anchor]");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (e) {
        e.preventDefault();
        var id = this.getAttribute("data-home-anchor");
        var el = id ? document.getElementById(id) : null;
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function scrollToAnchorTarget(el) {
    var header = document.querySelector(".site-header");
    var headerHeight = header ? header.offsetHeight : 0;
    var y = el.getBoundingClientRect().top + window.pageYOffset - headerHeight - 28;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  /* ------------------------------------------------------------------------
   * Render: Document Page — Markdown rendering + TOC
   * ------------------------------------------------------------------------ */
  async function renderDoc(id) {
    state.currentDocId = id;

    /* Find doc in manifest */
    var doc = null;
    if (state.docsManifest && state.docsManifest.docs) {
      doc = state.docsManifest.docs.filter(function (d) {
        return d.id === id;
      })[0];
    }

    if (!doc) {
      setMain(
        '<div class="error-card">' +
          "<h3>" + esc($t("doc_not_found")) + "</h3>" +
          "<p>" + esc($t("doc_not_found_desc")) + "</p>" +
          "<p style=\"font-family:var(--font-mono);font-size:var(--font-size-xs);\">" +
            "ID: " + esc(id) +
          "</p>" +
          '<a href="#/" class="btn">' + esc($t("back_home")) + "</a>" +
        "</div>"
      );
      renderToc(null);
      return;
    }

    renderLoading();

    try {
      var markdown = await Api.loadMarkdown(doc);

      /* Category label */
      var catLabel = doc.category;
      if (state.siteConfig && state.siteConfig.categories) {
        var catObj = state.siteConfig.categories.filter(function (c) {
          return c.id === doc.category;
        })[0];
        if (catObj && catObj.label && catObj.label[state.lang]) {
          catLabel = catObj.label[state.lang];
        }
      }

      /* Edit URL */
      var editUrl = CONFIG.contentRepoUrl ? CONFIG.contentRepoUrl.replace(/\/+$/, "") + "/edit/main/" + doc.path : "";

      /* Render Markdown to HTML + TOC */
      var result = MarkdownRenderer.renderMarkdown(
        markdown, doc, state.docsManifest
      );

      var h = '<article class="doc-page doc-page-' + esc(safeClassName(doc.id)) + '">';

      /* Doc header */
      h += '<div class="doc-header">' +
        "<h1>" + esc(doc.title) + "</h1>";

      if (doc.summary) {
        h += '<p class="doc-summary">' + esc(doc.summary) + "</p>";
      }

      h += '<div class="meta-row">' +
        '<span class="meta-chip">' + esc($t("doc_category")) + ": " +
          esc(catLabel) + "</span>";

      if (doc.tags && doc.tags.length > 0) {
        for (var ti = 0; ti < doc.tags.length; ti++) {
          h += '<span class="meta-chip meta-chip-tag">' +
            esc(doc.tags[ti]) + "</span>";
        }
      }
      h += "</div>";

      h += '<div class="meta-row meta-row-secondary">' +
        '<span class="meta-text">' + esc($t("doc_path_label")) + ": " +
          '<code>' + esc(doc.path) + "</code></span>" +
      "</div>";

      if (editUrl) {
        h += '<a class="btn" href="' + esc(editUrl) +
          '" target="_blank" rel="noopener">' +
          esc($t("edit_on_github")) + "</a>";
      }

      h += "</div>"; /* /.doc-header */

      /* Rendered Markdown body */
      h += '<div class="markdown-body">' + result.html + "</div>";
      h += "</article>";

      setMain(h);

      /* Render TOC */
      renderToc(result.toc);
    } catch (err) {
      setMain(
        '<div class="error-card">' +
          "<h3>" + esc($t("doc_load_error")) + "</h3>" +
          "<pre class=\"error-detail\">" + esc(err.message || String(err)) + "</pre>" +
          '<p><strong>Doc:</strong> ' + esc(doc.title) + "</p>" +
          '<p><strong>Path:</strong> <code>' + esc(doc.path) + "</code></p>" +
          '<a href="#/" class="btn">' + esc($t("back_home")) + "</a>" +
        "</div>"
      );
      renderToc(null);
    }
  }

  /* ------------------------------------------------------------------------
   * Render: Placeholder — unimplemented routes
   * ------------------------------------------------------------------------ */

  /* ------------------------------------------------------------------------
   * Render: Resource Page — LocoWiki-style resource cards
   * ------------------------------------------------------------------------ */
  function renderResourcesPage(params) {
    var filters = {};
    filters.track = params.track || "";
    if (params.type) filters.type = params.type;
    if (params.level) filters.level = params.level;
    if (params.lang) filters.lang = params.lang;

    if (!state.resourcesData) {
      Api.loadResources().then(function (data) {
        state.resourcesData = data;
        renderResourcesPage(params);
      }).catch(function (err) {
        setMain('<div class="error-card"><h3>' + esc($t("error_title")) + '</h3><pre class="error-detail">' + esc(err.message || String(err)) + '</pre></div>');
      });
      return;
    }

    var html = ResourceCards.renderResourcePage(state.resourcesData, {
      lang: state.lang,
      filters: filters
    });

    setMain(html);

    /* Bind filter chip clicks */
    bindResourceFilters();
  }

  function bindResourceFilters() {
    var chips = document.querySelectorAll(".resource-filter-chip[data-filter]");
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener("click", function (e) {
        e.preventDefault();
        var key = this.getAttribute("data-filter");
        var val = this.getAttribute("data-value") || "";

        /* Build new params from current hash */
        var hash = window.location.hash || "#/resources";
        var parsed = parseHashRoute(hash);
        var params = {};
        /* Copy existing params */
        for (var k in parsed.params) {
          if (parsed.params.hasOwnProperty(k)) params[k] = parsed.params[k];
        }

        if (val) {
          params[key] = val;
        } else {
          delete params[key];
        }

        var newHash = "#/resources";
        var parts = [];
        for (var pk in params) {
          if (params.hasOwnProperty(pk) && params[pk]) {
            parts.push(pk + "=" + encodeURIComponent(params[pk]));
          }
        }
        if (parts.length > 0) newHash += "?" + parts.join("&");
        window.location.hash = newHash;
      });
    }

    /* Clear filters button */
    var clearBtns = document.querySelectorAll(".resource-clear-filters[data-filter]");
    for (var j = 0; j < clearBtns.length; j++) {
      clearBtns[j].addEventListener("click", function (e) {
        e.preventDefault();
        window.location.hash = "#/resources";
      });
    }
  }

  function renderResourceToc() {
    var tocEl = document.getElementById("toc");
    if (!tocEl) return;
    tocEl.innerHTML = "<h4>" + esc($t("resources")) + "</h4>";
  }
  function renderPlaceholder(hash) {
    setMain(
      '<div class="placeholder-block">' +
        '<div class="placeholder-icon">🛠</div>' +
        "<h3>" + esc($t("placeholder_title")) + "</h3>" +
        "<p>" + esc($t("placeholder_desc")) + "</p>" +
        '<p style="margin-top:1em;font-family:var(--font-mono);font-size:var(--font-size-xs);">' +
          "Route: " + esc(hash) +
        "</p>" +
        '<a href="#/" class="btn" style="margin-top:1em;">' +
          esc($t("back_home")) +
        "</a>" +
      "</div>"
    );
  }

  /* ======================================================================
   * Round 6 — TOC Scroll Spy
   * ====================================================================== */

  function setupTocSpy() {
    cleanupTocSpy();

    if (typeof IntersectionObserver === "undefined") return;

    var headings = document.querySelectorAll(".markdown-body h2[id], .markdown-body h3[id]");
    if (!headings.length) return;

    var tocLinks = document.querySelectorAll(".toc-link[data-toc-id]");
    if (!tocLinks.length) return;

    /* Build a map from heading id → toc link */
    var linkMap = {};
    for (var i = 0; i < tocLinks.length; i++) {
      var link = tocLinks[i];
      var id = link.getAttribute("data-toc-id");
      if (id) linkMap[id] = link;
    }

    tocObserver = new IntersectionObserver(
      function (entries) {
        /* Find the first heading that is intersecting */
        var activeId = null;
        for (var e = 0; e < entries.length; e++) {
          if (entries[e].isIntersecting) {
            activeId = entries[e].target.id;
            break;
          }
        }

        /* Clear all active */
        var allLinks = document.querySelectorAll(".toc-link.active");
        for (var a = 0; a < allLinks.length; a++) {
          allLinks[a].classList.remove("active");
        }

        /* Set active on matching link */
        if (activeId && linkMap[activeId]) {
          linkMap[activeId].classList.add("active");
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      }
    );

    for (var h = 0; h < headings.length; h++) {
      tocObserver.observe(headings[h]);
    }
  }

  function cleanupTocSpy() {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
  }

  /* ======================================================================
   * Round 6 — Category Page
   * ====================================================================== */

  function categoryDescription(catId) {
    var fallback = {
      zh: "该分类下的学习文档和资料入口。",
      en: "Learning documents and resources in this category.",
    };
    if (state.siteConfig && state.siteConfig.categories) {
      var catObj = state.siteConfig.categories.filter(function (c) { return c.id === catId; })[0];
      if (catObj && catObj.description && catObj.description[state.lang]) {
        return catObj.description[state.lang];
      }
    }
    return fallback[state.lang] || fallback.zh;
  }

  function renderCategoryToc() {
    var tocEl = document.getElementById("toc");
    if (!tocEl) return;
    tocEl.innerHTML = "<h4>" + esc($t("category")) + "</h4>";
  }

  function renderCategoryPage(category) {
    cleanupTocSpy();
    state.currentDocId = null;
    state.currentCategory = category;

    if (!state.docsManifest || !state.docsManifest.docs) {
      renderCategoryEmpty(category);
      renderCategoryToc();
      return;
    }

    /* Filter docs: current language + this category, sorted by order then title */
    var docs = state.docsManifest.docs.filter(function (d) {
      return d.lang === state.lang && d.category === category;
    });
    docs.sort(function (a, b) {
      var oa = typeof a.order === "number" ? a.order : 999;
      var ob = typeof b.order === "number" ? b.order : 999;
      if (oa !== ob) return oa - ob;
      return (a.title || "").localeCompare(b.title || "");
    });

    if (docs.length === 0) {
      renderCategoryEmpty(category);
      renderCategoryToc();
      return;
    }

    /* Collect unique tags */
    var tagSet = {};
    for (var i = 0; i < docs.length; i++) {
      var dt = docs[i].tags || [];
      for (var j = 0; j < dt.length; j++) {
        tagSet[dt[j]] = true;
      }
    }
    var allTags = Object.keys(tagSet).sort();

    /* Recommended entry: first doc (lowest order) */
    var entryDoc = docs[0];

    var h = '<div class="category-page">';

    /* Header */
    h += '<div class="category-header">' +
      "<h1>" + esc(categoryLabel(category)) + "</h1>" +
      '<p class="category-desc">' + esc(categoryDescription(category)) + "</p>" +
      '<div class="category-meta">' +
        '<div class="category-stat">' +
          '<div class="stat-num">' + docs.length + "</div>" +
          '<div class="stat-lbl">' + esc($t("document_count")) + "</div>" +
        "</div>" +
        '<div class="category-stat">' +
          '<div class="stat-num">' + allTags.length + "</div>" +
          '<div class="stat-lbl">' + esc($t("tag_count")) + "</div>" +
        "</div>" +
        '<div class="category-stat">' +
          '<div class="stat-num">' + esc(state.lang) + "</div>" +
          '<div class="stat-lbl">' + esc($t("current_language")) + "</div>" +
        "</div>" +
      "</div>" +
    "</div>";

    /* Recommended entry */
    h += '<div class="category-recommended">' +
      "<h3>" + esc($t("recommended_entry")) + "</h3>" +
      '<a href="#/doc/' + esc(entryDoc.id) + '">' + esc(entryDoc.title) + "</a>";
    if (entryDoc.summary) {
      h += ' <span style="color:var(--color-muted);font-size:var(--font-size-sm);">— ' +
        esc(entryDoc.summary) + "</span>";
    }
    h += "</div>";

    /* Tag cloud */
    if (allTags.length > 0) {
      h += '<div class="category-tag-cloud">';
      for (var ti = 0; ti < allTags.length; ti++) {
        h += '<span class="meta-chip meta-chip-tag category-tag" data-tag="' + esc(allTags[ti]) + '" data-category="' + esc(category) + '">' +
          esc(allTags[ti]) + "</span>";
      }
      h += "</div>";
    }

    /* Doc cards */
    h += '<div class="category-doc-grid">';
    for (var di = 0; di < docs.length; di++) {
      var doc = docs[di];
      h += '<a class="category-doc-card" href="#/doc/' + esc(doc.id) + '">' +
        '<div class="category-doc-title">' + esc(doc.title) + "</div>";
      if (doc.summary) {
        h += '<div class="category-doc-summary">' + esc(doc.summary) + "</div>";
      }
      h += '<div class="category-doc-footer">';
      if (doc.tags && doc.tags.length > 0) {
        for (var tgi = 0; tgi < doc.tags.length; tgi++) {
          h += '<span class="meta-chip meta-chip-tag">' + esc(doc.tags[tgi]) + "</span>";
        }
      }
      if (typeof doc.readingTime === "number") {
        h += '<span>' + doc.readingTime + " min</span>";
      }
      h += "</div></a>";
    }
    h += "</div></div>";

    /* Related resources for this category */
    if (state.resourcesData) {
      var relatedHtml = ResourceCards.renderRelatedResources(state.resourcesData, category, state.lang, 3);
      if (relatedHtml) {
        h += relatedHtml;
      }
    }

    setMain(h);

    /* Attach tag click handlers */
    var tags = document.querySelectorAll(".category-tag[data-tag]");
    for (var tgi2 = 0; tgi2 < tags.length; tgi2++) {
      tags[tgi2].addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var t = this.getAttribute("data-tag") || "";
        var c = this.getAttribute("data-category") || "";
        window.location.hash = "#/search?q=" + encodeURIComponent(t) + "&category=" + encodeURIComponent(c);
      });
    }

    renderCategoryToc();
  }

  function renderCategoryEmpty(category) {
    setMain(
      '<div class="category-page">' +
        '<div class="category-header">' +
          "<h1>" + esc(categoryLabel(category)) + "</h1>" +
        "</div>" +
        '<div class="category-empty">' +
          "<h3>" + esc($t("category_empty")) + "</h3>" +
          "<p>" + esc($t("category_empty_desc")) + "</p>" +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
   * Utility — parse hash route into route + params
   *   "#/search?q=plc&category=foo" → { route: "#/search", params: { q: "plc", category: "foo" } }
   * ------------------------------------------------------------------------ */
  function parseHashRoute(hash) {
    var route = hash;
    var params = {};
    var qIdx = hash.indexOf("?");
    if (qIdx !== -1) {
      route = hash.substring(0, qIdx);
      var qs = hash.substring(qIdx + 1);
      var pairs = qs.split("&");
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i];
        var eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          var k = decodeURIComponent(pair.substring(0, eqIdx));
          var v = decodeURIComponent(pair.substring(eqIdx + 1));
          params[k] = v;
        }
      }
    }
    return { route: route, params: params };
  }

  /* ------------------------------------------------------------------------
   * Search — load search index (lazy, cached)
   * ------------------------------------------------------------------------ */
  async function loadSearchIndex() {
    if (state.searchIndex) return state.searchIndex;
    state.searchLoading = true;
    state.searchError = null;
    try {
      state.searchIndex = await Api.loadSearchIndex();
      return state.searchIndex;
    } catch (err) {
      state.searchError = err;
      throw err;
    } finally {
      state.searchLoading = false;
    }
  }

  /* ------------------------------------------------------------------------
   * Render: Search — category label helper
   * ------------------------------------------------------------------------ */
  function categoryLabel(catId) {
    if (!catId) return "";
    if (state.siteConfig && state.siteConfig.categories) {
      var catObj = state.siteConfig.categories.filter(function (c) { return c.id === catId; })[0];
      if (catObj && catObj.label && catObj.label[state.lang]) {
        return catObj.label[state.lang];
      }
    }
    return catId;
  }

  /* ------------------------------------------------------------------------
   * Render: Search — empty state
   * ------------------------------------------------------------------------ */
  function renderSearchEmpty() {
    setMain(
      '<div class="search-page">' +
        '<div class="search-empty">' +
          "<h2>" + esc($t("search")) + "</h2>" +
          '<p class="search-empty-desc">' + esc($t("search_empty_desc")) + "</p>" +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
   * Render: Search — loading state
   * ------------------------------------------------------------------------ */
  function renderSearchLoading() {
    setMain(
      '<div class="search-page">' +
        '<div class="loading-block">' +
          '<div class="loading-spinner"></div>' +
          '<p class="loading-text">' + esc($t("search_loading")) + "</p>" +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
   * Render: Search — error state
   * ------------------------------------------------------------------------ */
  function renderSearchError(err) {
    setMain(
      '<div class="search-page">' +
        '<div class="error-card">' +
          '<div class="error-icon">!</div>' +
          "<h3>" + esc($t("search_error")) + "</h3>" +
          "<pre class=\"error-detail\">" + esc(err.message || String(err)) + "</pre>" +
          '<button class="btn" onclick="App.route()">' + esc($t("error_retry")) + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------------
   * Render: Search — no results
   * ------------------------------------------------------------------------ */
  function renderSearchNoResults(query, category) {
    var h = '<div class="search-page">';
    h += renderSearchMeta(query, category);
    h += '<div class="search-no-results">' +
      "<h3>" + esc($t("search_no_results")) + "</h3>" +
      "<p>" + esc($t("search_no_results_desc")) + "</p>" +
    "</div></div>";
    setMain(h);
  }

  /* ------------------------------------------------------------------------
   * Render: Search — meta bar (query / lang / category chips)
   * ------------------------------------------------------------------------ */
  function renderSearchMeta(query, category) {
    var h = '<div class="search-header">';
    h += "<h1>" + esc($t("search")) + "</h1>";
    h += '<div class="search-meta">';
    if (query) {
      h += '<span class="meta-chip">' + esc($t("search_query")) + ": " + esc(query) + "</span>";
    }
    h += '<span class="meta-chip">' + esc($t("search_language")) + ": " + esc(state.lang) + "</span>";
    if (category) {
      h += '<span class="meta-chip">' + esc($t("search_category")) + ": " + esc(categoryLabel(category)) + "</span>";
    }
    h += "</div></div>";
    return h;
  }

  /* ------------------------------------------------------------------------
   * Render: Search — category filter buttons
   * ------------------------------------------------------------------------ */
  function renderSearchFilters(query, currentCategory) {
    var categories = [];
    if (state.docsManifest && state.docsManifest.docs) {
      var seen = {};
      for (var i = 0; i < state.docsManifest.docs.length; i++) {
        var d = state.docsManifest.docs[i];
        if (d.lang === state.lang && !seen[d.category]) {
          seen[d.category] = true;
          categories.push(d.category);
        }
      }
    }
    if (categories.length === 0) return "";

    var h = '<div class="search-filters">';
    var allActive = !currentCategory ? ' active' : '';
    h += '<button class="filter-chip' + allActive + '" data-filter-category="">' +
      esc($t("search_all_categories")) + "</button>";

    for (var j = 0; j < categories.length; j++) {
      var cat = categories[j];
      var active = cat === currentCategory ? ' active' : '';
      h += '<button class="filter-chip' + active + '" data-filter-category="' + esc(cat) + '">' +
        esc(categoryLabel(cat)) + "</button>";
    }
    h += "</div>";
    return h;
  }

  /* ------------------------------------------------------------------------
   * Render: Search — single result card
   * ------------------------------------------------------------------------ */
  function renderSearchResultCard(result, tokens) {
    var h = '<a class="search-result-card" href="' + esc(result.route) + '">';

    h += '<div class="search-result-title">' + SearchEngine.highlight(result.title, tokens) + "</div>";
    h += '<div class="search-result-snippet">' + SearchEngine.highlight(result.snippet, tokens) + "</div>";

    h += '<div class="meta-row">';
    h += '<span class="meta-chip">' + esc(categoryLabel(result.category)) + "</span>";

    if (result.tags && result.tags.length > 0) {
      for (var i = 0; i < result.tags.length; i++) {
        h += '<span class="meta-chip meta-chip-tag result-tag" data-tag="' + esc(result.tags[i]) + '">' +
          SearchEngine.highlight(result.tags[i], tokens) + "</span>";
      }
    }
    h += "</div>";

    h += '<div class="matched-fields">' +
      esc($t("search_matched_fields")) + ": " + esc(result.matchedFields.join(", ")) +
    "</div>";

    h += "</a>";
    return h;
  }

  /* ------------------------------------------------------------------------
   * Render: Search — results list
   * ------------------------------------------------------------------------ */
  function renderSearchResults(query, category, results) {
    var tokens = SearchEngine.tokenize(SearchEngine.normalizeQuery(query));

    var h = '<div class="search-page">';
    h += renderSearchMeta(query, category);
    h += renderSearchFilters(query, category);

    h += '<p class="search-result-count">' +
      results.length + " " + esc($t("search_results")) + "</p>";

    h += '<div class="search-results">';
    for (var i = 0; i < results.length; i++) {
      h += renderSearchResultCard(results[i], tokens);
    }
    h += "</div></div>";

    setMain(h);
    attachSearchEvents();
  }

  /* ------------------------------------------------------------------------
   * Search — attach click handlers for filters and tags
   * ------------------------------------------------------------------------ */
  function attachSearchEvents() {
    /* Category filter buttons */
    var filters = document.querySelectorAll(".filter-chip[data-filter-category]");
    for (var i = 0; i < filters.length; i++) {
      filters[i].addEventListener("click", function (e) {
        e.preventDefault();
        var cat = this.getAttribute("data-filter-category") || "";
        var input = document.getElementById("search-input");
        var q = input ? input.value.trim() : "";
        var hash = "#/search";
        var params = [];
        if (q) params.push("q=" + encodeURIComponent(q));
        if (cat) params.push("category=" + encodeURIComponent(cat));
        if (params.length) hash += "?" + params.join("&");
        window.location.hash = hash;
      });
    }

    /* Tag click → search by tag */
    var tags = document.querySelectorAll(".result-tag[data-tag]");
    for (var j = 0; j < tags.length; j++) {
      tags[j].addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tag = this.getAttribute("data-tag") || "";
        window.location.hash = "#/search?q=" + encodeURIComponent(tag);
      });
    }
  }

  /* ------------------------------------------------------------------------
   * Render: Search — TOC placeholder
   * ------------------------------------------------------------------------ */
  function renderTocSearch() {
    var tocEl = document.getElementById("toc");
    if (!tocEl) return;
    tocEl.innerHTML = "<h4>" + esc($t("search_results")) + "</h4>";
  }

  /* ------------------------------------------------------------------------
   * Render: Search Page (main entry) — searches resources + docs
   * ------------------------------------------------------------------------ */
  async function renderSearchPage(params) {
    var query = (params.q || "").trim();
    var category = params.category || "";

    /* Sync search input with URL */
    var input = document.getElementById("search-input");
    if (input) input.value = query;

    /* Empty query → empty state */
    if (!query) {
      renderSearchEmpty();
      return;
    }

    /* Ensure resourcesData is loaded */
    if (!state.resourcesData) {
      try { state.resourcesData = await Api.loadResources(); } catch (e) { /* non-fatal */ }
    }

    /* Search resources */
    var resourceResults = [];
    if (state.resourcesData) {
      var items = ResourceCards.normalizeResources(state.resourcesData);
      var qLower = query.toLowerCase();
      resourceResults = items.filter(function (item) {
        var title = (item.title && item.title.zh || item.title || "").toLowerCase();
        var source = (item.source || "").toLowerCase();
        var summary = (item.summary && item.summary.zh || item.summary || "").toLowerCase();
        var tags = (item.tags || []).join(" ").toLowerCase();
        var haystack = title + " " + source + " " + summary + " " + tags;
        return haystack.indexOf(qLower) !== -1;
      });
      if (category) {
        resourceResults = resourceResults.filter(function (item) {
          return item.track === category || item.category === category;
        });
      }
      resourceResults.sort(function (a, b) { return (a.priority || 99) - (b.priority || 99); });
    }

    /* Search docs (secondary) */
    var docResults = [];
    try {
      if (!state.searchIndex) await loadSearchIndex();
      if (state.searchIndex) {
        docResults = SearchEngine.search(state.searchIndex, query, {
          lang: state.lang,
          category: category || null,
        });
      }
    } catch (e) { /* non-fatal */ }

    if (resourceResults.length === 0 && docResults.length === 0) {
      renderSearchNoResults(query, category);
    } else {
      renderSearchResultsMixed(query, category, resourceResults, docResults);
    }
  }

  function renderSearchResultsMixed(query, category, resourceResults, docResults) {
    var h = '<div class="search-page">';
    h += renderSearchMeta(query, category);
    h += '<p class="search-result-count">' + (resourceResults.length + docResults.length) + " " + esc($t("search_results")) + "</p>";

    /* Resource results first */
    if (resourceResults.length > 0) {
      h += '<div class="search-results">';
      for (var i = 0; i < resourceResults.length; i++) {
        h += renderResourceSearchCard(resourceResults[i]);
      }
      h += '</div>';
    }

    /* Doc results second */
    if (docResults.length > 0) {
      h += '<h3 style="margin-top:1.5em;">' + esc($t("search_results_docs") || "Document Results") + '</h3>';
      h += '<div class="search-results">';
      var tokens = SearchEngine.tokenize(SearchEngine.normalizeQuery(query));
      for (var j = 0; j < docResults.length; j++) {
        h += renderSearchResultCard(docResults[j], tokens);
      }
      h += '</div>';
    }

    h += "</div>";
    setMain(h);
  }

  function renderResourceSearchCard(item) {
    var hasUrl = ResourceCards.safeUrl(item.url);
    var h = '<a class="search-result-card"';
    if (hasUrl) {
      h += ' href="' + ResourceCards.attr(item.url) + '" target="_blank" rel="noreferrer noopener"';
    } else {
      h += ' href="#/resources?track=' + ResourceCards.esc(item.track || '') + '"';
    }
    h += '>';
    h += '<div class="search-result-title">' + ResourceCards.esc((item.title && item.title.zh) || item.title || "") + '</div>';
    h += '<div class="search-result-snippet">' + ResourceCards.esc((item.summary && item.summary.zh) || item.summary || "") + '</div>';
    h += '<div class="meta-row">';
    h += '<span class="meta-chip">' + ResourceCards.esc(item.source || item.track || "") + '</span>';
    if (item.tags && item.tags.length > 0) {
      for (var i = 0; i < Math.min(item.tags.length, 3); i++) {
        h += '<span class="meta-chip meta-chip-tag">' + ResourceCards.esc(item.tags[i]) + '</span>';
      }
    }
    h += '</div></a>';
    return h;
  }

  /* ------------------------------------------------------------------------
   * Search Form Binding
   * ------------------------------------------------------------------------ */
  function bindSearchForm() {
    var form = document.getElementById("site-search-form");
    var input = document.getElementById("search-input");

    function handleSubmit(e) {
      e.preventDefault();
      var q = input ? input.value.trim() : "";
      if (!q) {
        window.location.hash = "#/search";
      } else {
        window.location.hash = "#/search?q=" + encodeURIComponent(q);
      }
    }

    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
    /* Also handle Enter on input directly (fallback if no form) */
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          handleSubmit(e);
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
   * Layout helpers — show/hide sidebar and TOC per route
   * ------------------------------------------------------------------------ */
  function setLayoutMode(mode) {
    var body = document.body;
    var toc = document.getElementById("toc");

    body.classList.remove("route-home", "route-doc", "route-resources", "route-search");

    if (mode === "home") {
      body.classList.add("route-home");
      if (toc) toc.style.display = "none";
    } else if (mode === "doc") {
      body.classList.add("route-doc");
      if (toc) toc.style.display = "";
    } else if (mode === "resources") {
      body.classList.add("route-resources");
      if (toc) toc.style.display = "none";
    } else if (mode === "search") {
      body.classList.add("route-search");
      if (toc) toc.style.display = "none";
    }
  }

  /* ------------------------------------------------------------------------
   * Router
   * ------------------------------------------------------------------------ */
  function route() {
    var hash = window.location.hash || "#/";
    var parsed = parseHashRoute(hash);

    /* #/ or empty → home */
    if (parsed.route === "#/" || parsed.route === "") {
      state.currentDocId = null;
      state.currentCategory = null;
      cleanupTocSpy();
      setLayoutMode("home");
      if (state.isReady && state.homeData) {
        renderHome();
      } else {
        renderLoading();
      }
      return;
    }

    /* #/category/<id> → redirect to resources */
    var catMatch = parsed.route.match(/^#\/category\/(.+)$/);
    if (catMatch) {
      window.location.hash = "#/resources?track=" + encodeURIComponent(decodeURIComponent(catMatch[1]));
      return;
    }

    /* Category aliases → redirect to resources */
    if (Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, parsed.route)) {
      var aliasTrack = CATEGORY_ALIASES[parsed.route];
      window.location.hash = aliasTrack ? "#/resources?track=" + encodeURIComponent(aliasTrack) : "#/resources";
      return;
    }

    /* #/search → search page */
    if (parsed.route === "#/search") {
      state.currentDocId = null;
      state.currentCategory = null;
      cleanupTocSpy();
      setLayoutMode("search");
      if (state.isReady) {
        renderSearchPage(parsed.params);
      } else {
        renderLoading();
      }
      return;
    }

    /* #/doc/<id> → document page (compat, no sidebar) */
    var docMatch = parsed.route.match(/^#\/doc\/(.+)$/);
    if (docMatch) {
      var docId = decodeURIComponent(docMatch[1]);
      state.currentDocId = docId;
      state.currentCategory = null;
      cleanupTocSpy();
      setLayoutMode("doc");
      if (state.isReady && state.docsManifest) {
        renderDoc(docId);
      } else {
        renderLoading();
      }
      return;
    }

    /* #/resources → resource card page */
    if (parsed.route === "#/resources") {
      state.currentDocId = null;
      state.currentCategory = null;
      cleanupTocSpy();
      setLayoutMode("resources");
      if (state.isReady) {
        renderResourcesPage(parsed.params);
      } else {
        renderLoading();
      }
      return;
    }

    /* Everything else → placeholder */
    state.currentDocId = null;
    state.currentCategory = null;
    cleanupTocSpy();
    renderPlaceholder(hash);
    renderToc(null);
  }

  /* ------------------------------------------------------------------------
   * Language Change Handler
   * ------------------------------------------------------------------------ */
  async function onLangChange(event) {
    state.lang = (event && event.detail && event.detail.lang) || I18n.getLang();
    if (!state.isReady) return;

    /* Reload resources */
    try {
      state.resourcesData = await Api.loadResources();
    } catch (err) {
      /* Non-fatal */
    }

    var hash = window.location.hash || "#/";
    var parsed = parseHashRoute(hash);

    /* If on search page, re-run current search */
    if (parsed.route === "#/search") {
      try {
        state.homeData = await Api.loadHomeData(state.lang);
      } catch (err) {
        /* Non-fatal — search page still works without home data */
      }
      renderSearchPage(parsed.params);
      return;
    }

    /* If on category page, re-render */
    var catMatch = parsed.route.match(/^#\/category\/(.+)$/);
    var catId = null;
    if (catMatch) {
      catId = decodeURIComponent(catMatch[1]);
    } else if (Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, parsed.route)) {
      catId = CATEGORY_ALIASES[parsed.route];
    }
    if (catId) {
      try {
        state.homeData = await Api.loadHomeData(state.lang);
      } catch (err) {
        /* Non-fatal */
      }
      renderCategoryPage(catId);
      return;
    }

    renderLoading();
    try {
      state.homeData = await Api.loadHomeData(state.lang);
      route();
    } catch (err) {
      renderError(err);
    }
  }

  /* ------------------------------------------------------------------------
   * Initialize
   * ------------------------------------------------------------------------ */
  async function init() {
    Theme.init();
    I18n.init();

    state.lang = I18n.getLang();
    renderLoading();

    try {
      /* Load site config and docs manifest in parallel */
      var results = await Promise.all([
        Api.loadSiteConfig(),
        Api.loadDocsManifest(),
      ]);
      state.siteConfig = results[0];
      state.docsManifest = results[1];

      /* Load home data for current language */
      state.homeData = await Api.loadHomeData(state.lang);

      /* Load resources data */
      try {
        state.resourcesData = await Api.loadResources();
      } catch (err) {
        /* Non-fatal — resources are optional */
        console.warn("Failed to load resources:", err.message);
      }

      state.isReady = true;

      /* Listen for language changes */
      window.addEventListener("ema:langchange", onLangChange);

      /* Bind search form */
      bindSearchForm();

      /* Listen for hash changes */
      window.addEventListener("hashchange", function () {
        route();
      });

      /* Initial route */
      route();
    } catch (err) {
      console.error("术语地图 init failed:", err);
      renderError(err);
    }
  }

  /* ------------------------------------------------------------------------
   * retry — called by the error card retry button
   * ------------------------------------------------------------------------ */
  function retry() {
    Api.clearApiCache();
    cleanupTocSpy();
    state.isReady = false;
    state.docsManifest = null;
    state.siteConfig = null;
    state.homeData = null;
    state.searchIndex = null;
    state.searchError = null;
    state.currentCategory = null;
    init();
  }

  return { init, route, retry };
})();

/* Boot when DOM is ready */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", App.init);
} else {
  App.init();
}
