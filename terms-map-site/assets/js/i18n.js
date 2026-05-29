/*
 * 术语地图 — i18n Manager
 * ============================================================================
 * 管理 zh/en 语言切换。
 * - 从 localStorage 读取当前语言
 * - 点击按钮切换
 * - 派发 ema:langchange 事件通知 app.js 重新渲染
 */

const I18n = (() => {
  const STORAGE_KEY = "terms-map-lang";

  /* UI strings for each supported language */
  const strings = {
    zh: {
      site_title: "术语地图",
      search_placeholder: "搜索文档...",
      nav_start: "术语与案例",
      nav_elektrotechnik: "数学",
      nav_mechatronik: "电子",
      nav_automatisierung: "编程",
      nav_career: "信号与控制",
      nav_resources: "资源索引",
      toc_title: "目录",
      theme_light: "浅色模式",
      theme_dark: "深色模式",
      lang_label: "EN",
      home_hero_title: "术语地图",
      home_hero_subtitle: "",
      home_hero_desc: "",
      home_tracks_title: "按问题找资源",
      home_roadmap_title: "学习路线",
      home_featured_title: "精选文档",
      home_resources_title: "索引",
      placeholder_title: "功能开发中",
      placeholder_desc:
        "该功能将在后续轮次实现。当前为第三轮数据加载版本。",
      footer_text: "术语地图",
      footer_github: "GitHub",

      loading: "加载中...",
      error_title: "数据加载失败",
      error_hint_server:
        "请确认是否从 D:\\Yuan 启动了本地服务器：python -m http.server 8080",
      error_hint_dist:
        "请确认内容仓库 dist 文件已生成：node scripts\\build-index.mjs",
      error_hint_config: "请检查 config.js 中的 contentBase 配置是否正确",
      error_retry: "重试",
      doc_not_found: "文档未找到",
      doc_not_found_desc: "文档 ID 不存在，可能已被移除或链接错误。",
      doc_load_error: "文档加载失败",
      edit_on_github: "在 GitHub 上编辑",
      doc_category: "分类",
      doc_tags: "标签",
      doc_path_label: "路径",
      back_home: "← 返回首页",
      home_view_roadmap: "查看路线 →",

      toc_empty: "本文暂无目录",
      render_fallback_warning: "Markdown 渲染器不可用",
      render_fallback_desc: "marked.js 或 DOMPurify 加载失败，以下为 Markdown 原文。",

      search: "搜索",
      search_placeholder: "搜索文档、标签、关键词...",
      search_empty_title: "开始搜索",
      search_empty_desc: "输入关键词搜索文档、标签和摘要。",
      search_results: "搜索结果",
      search_no_results: "没有找到匹配结果",
      search_no_results_desc: "尝试更换关键词，或切换分类过滤。",
      search_query: "当前查询",
      search_language: "当前语言",
      search_category: "当前分类",
      search_all_categories: "全部",
      search_matched_fields: "命中字段",
      search_results_docs: "文档结果",
      search_loading: "正在加载搜索索引...",
      search_error: "搜索索引加载失败",

      open_navigation: "打开导航",
      close_navigation: "关闭导航",
      category: "分类",
      categories: "分类",
      browse_category: "浏览分类",
      category_docs: "分类文档",
      category_empty: "该分类暂无文档",
      category_empty_desc: "该分类下暂无当前语言的文档。",
      document_count: "文档数量",
      tag_count: "标签数量",
      recommended_entry: "推荐入口",
      read_doc: "阅读文档",
      current_language: "当前语言",

      /* Round 11 — Resource Cards */
      resources: "资源索引",
      resource_index: "资源索引",
      resources_title: "资源",
      resources_description: "",
      resource_intro: "",
      resource_count: "资源数量",
      direct_link: "直达链接",
      why_read: "为什么值得读",
      how_to_read: "如何阅读",
      source: "来源",
      verified_date: "核验日期",
      pending_verify: "待核验",
      filter_track: "学习方向",
      filter_type: "类型",
      filter_level: "难度",
      filter_lang: "语言",
      clear_filters: "清空筛选",
      featured_resources: "精选资源",
      related_resources: "相关资源",
      terms_entry_short: "查术语",
      terms_entry_kicker: "遇到一个看不懂的工程词？",
      terms_entry_title: "先把这个词查清楚",
      terms_entry_desc: "不管是在装机、维修、视频、项目还是日常设备里看到的词，都可以先来这里查：它是什么意思，背后牵到哪块知识，接下来该补什么。",
      terms_entry_action: "去查术语",

      /* Round 12 — Homepage resource cards */
      foundation_featured_videos: "可以先看的资源",
      foundation_timeline: "时间线",
      foundation_people_org_works: "参考对象",
      people: "人物",
      organizations: "组织",
      works: "作品 / 项目",
      other_tracks: "按问题找资源",
      year: "年份",
      key_event: "关键事件",
      industry_impact: "对行业的影响",
      view_all_foundation_resources: "",
      home_view_roadmap: "查看路线 →",
    },
    en: {
      site_title: "术语地图",
      search_placeholder: "Search docs...",
      nav_start: "Terms and Cases",
      nav_elektrotechnik: "Math",
      nav_mechatronik: "Electronics",
      nav_automatisierung: "Programming",
      nav_career: "Signals and Control",
      nav_resources: "Resources",
      toc_title: "On this page",
      theme_light: "Light",
      theme_dark: "Dark",
      lang_label: "中文",
      home_hero_title: "术语地图",
      home_hero_subtitle: "",
      home_hero_desc: "",
      home_tracks_title: "Foundation Modules",
      home_roadmap_title: "Learning Roadmap",
      home_featured_title: "Featured Docs",
      home_resources_title: "Index",
      placeholder_title: "Coming Soon",
      placeholder_desc:
        "This feature will be implemented in a future round. Currently at Round 3 — data loading.",
      footer_text:
        "术语地图",
      footer_github: "GitHub",

      loading: "Loading...",
      error_title: "Failed to Load Data",
      error_hint_server:
        "Make sure you started the local server from D:\\Yuan: python -m http.server 8080",
      error_hint_dist:
        "Make sure the content repo dist files exist: node scripts\\build-index.mjs",
      error_hint_config:
        "Check if contentBase in config.js is set correctly",
      error_retry: "Retry",
      doc_not_found: "Document Not Found",
      doc_not_found_desc:
        "The requested document ID does not exist. It may have been removed or the link is incorrect.",
      doc_load_error: "Failed to Load Document",
      edit_on_github: "Edit on GitHub",
      doc_category: "Category",
      doc_tags: "Tags",
      doc_path_label: "Path",
      back_home: "← Back to Home",
      home_view_roadmap: "View Roadmap →",

      toc_empty: "No headings",
      render_fallback_warning: "Markdown renderer unavailable",
      render_fallback_desc: "marked.js or DOMPurify failed to load. Showing raw Markdown below.",

      search: "Search",
      search_placeholder: "Search docs, tags, keywords...",
      search_empty_title: "Start searching",
      search_empty_desc: "Enter keywords to search documents, tags and summaries.",
      search_results: "Search results",
      search_no_results: "No results found",
      search_no_results_desc: "Try another keyword or change the category filter.",
      search_query: "Query",
      search_language: "Language",
      search_category: "Category",
      search_all_categories: "All",
      search_matched_fields: "Matched fields",
      search_results_docs: "Document Results",
      search_loading: "Loading search index...",
      search_error: "Failed to load search index",

      open_navigation: "Open navigation",
      close_navigation: "Close navigation",
      category: "Category",
      categories: "Categories",
      browse_category: "Browse category",
      category_docs: "Category documents",
      category_empty: "No documents in this category",
      category_empty_desc: "No documents in this category for the current language.",
      document_count: "Documents",
      tag_count: "Tags",
      recommended_entry: "Recommended entry",
      read_doc: "Read document",
      current_language: "Current language",

      /* Round 11 — Resource Cards */
      resources: "Resources",
      resource_index: "Resource Index",
      resource_intro: "",
      resources_title: "Resources",
      resources_description: "",
      resource_count: "Resources",
      direct_link: "Direct link",
      why_read: "Why read it",
      how_to_read: "How to read it",
      source: "Source",
      verified_date: "Verified date",
      pending_verify: "Pending verification",
      filter_track: "Track",
      filter_type: "Type",
      filter_level: "Level",
      filter_lang: "Language",
      clear_filters: "Clear filters",
      featured_resources: "Featured resources",
      related_resources: "Related resources",
      terms_entry_short: "Look Up Terms",
      terms_entry_kicker: "Ran into an engineering word?",
      terms_entry_title: "Start by understanding the word",
      terms_entry_desc: "Whether it came from a PC build, repair, video, project, or daily device, look it up here first: what it means, what knowledge it points to, and what to learn next.",
      terms_entry_action: "Look up terms",

      /* Round 12 — Homepage resource cards */
      foundation_featured_videos: "Good Starting Resources",
      foundation_timeline: "Timeline",
      foundation_people_org_works: "Reference Objects",
      people: "People",
      organizations: "Organizations",
      works: "Works / Projects",
      other_tracks: "Find Resources by Problem",
      year: "Year",
      key_event: "Key Event",
      industry_impact: "Impact on Industry",
      view_all_foundation_resources: "",
      home_view_roadmap: "View Roadmap →",
    },
  };

  /* Cached resolved language */
  let _lang = null;

  /* Resolve language from localStorage or fallback to CONFIG.defaultLang */
  function resolve() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
    return (CONFIG && CONFIG.defaultLang) || "zh";
  }

  /* Update the language toggle button label and aria-label */
  function updateButtonLabel() {
    var btn = document.getElementById("language-toggle");
    if (!btn) return;
    var lang = _lang || resolve();
    btn.textContent = lang === "zh" ? "EN" : "中文";
    btn.setAttribute("aria-label",
      lang === "zh" ? "Switch to English" : "切换到中文"
    );
  }

  /* ==========================================================================
   * Public API
   * ========================================================================== */

  /**
   * getLang() — 返回当前语言 ("zh" | "en")
   */
  function getLang() {
    if (!_lang) _lang = resolve();
    return _lang;
  }

  /**
   * setLang(lang) — 设置语言
   * - 校验 zh/en
   * - 写入 localStorage
   * - 更新 document.documentElement.lang
   * - 更新按钮文案和 aria-label
   * - 派发 ema:langchange 事件
   */
  function setLang(lang) {
    if (lang !== "zh" && lang !== "en") {
      console.warn('I18n.setLang: invalid language "' + lang + '"');
      lang = (CONFIG && CONFIG.defaultLang) || "zh";
    }
    _lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    updateButtonLabel();

    window.dispatchEvent(new CustomEvent("ema:langchange", {
      detail: { lang: lang }
    }));
  }

  /**
   * toggleLang() — 在 zh/en 之间切换
   */
  function toggleLang() {
    var next = getLang() === "zh" ? "en" : "zh";
    setLang(next);
  }

  /**
   * init() — 初始化语言模块
   * - 读取当前语言
   * - 更新 document.documentElement.lang
   * - 查找并绑定语言按钮
   * - 更新按钮文案
   */
  function init() {
    _lang = resolve();
    document.documentElement.lang = _lang === "zh" ? "zh-CN" : "en";
    updateButtonLabel();

    var btn = document.getElementById("language-toggle");
    if (btn) {
      btn.addEventListener("click", toggleLang);
    } else {
      console.warn("I18n.init: language toggle button #language-toggle not found");
    }
  }

  /**
   * t(key) — 返回当前语言的文案
   * - key 缺失时返回 key 本身
   * - 不因缺少文案导致崩溃
   */
  function t(key) {
    var lang = getLang();
    return (strings[lang] && strings[lang][key]) || key;
  }

  return { getLang, setLang, toggleLang, init, t };
})();
