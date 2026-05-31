/*
 * 术语地图 — Resource Cards
 * ============================================================================
 * Renders external resource index with:
 * - audience_level grouping (小白/入门/进阶/查阅)
 * - media thumbnails & YouTube covers
 * - proper <a> external links (no esc() on href)
 * - sort: lang > type > priority within groups
 */

var ResourceCards = (function () {

  /* ==========================================================================
   * HTML Safety
   * ========================================================================== */

  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Escape only double-quotes for HTML attribute values. Do NOT escape & */
  function attr(str) {
    if (!str) return "";
    return String(str).replace(/"/g, "&quot;");
  }

  function safeUrl(url) {
    if (!url) return false;
    if (/^https?:\/\//i.test(url)) return true;
    if (/^mailto:/i.test(url)) return true;
    return false;
  }

  /* ==========================================================================
   * Normalize
   * ========================================================================== */

  function normalizeResources(data) {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map(function (item, i) { return normalizeItem(item, i); });
    }
    if (data.items && Array.isArray(data.items)) {
      return data.items.map(function (item, i) { return normalizeItem(item, i); });
    }
    return [];
  }

  function normalizeItem(item, index) {
    var id = item.id || ("res-" + index);

    var title = item.title;
    if (typeof title === "string") title = { zh: title, en: title };
    if (!title || typeof title !== "object") title = { zh: "Untitled", en: "Untitled" };

    var summary = item.summary || item.description || {};
    if (typeof summary === "string") summary = { zh: summary, en: summary };

    var impact = item.impact || {};
    if (typeof impact === "string") impact = { zh: impact, en: impact };

    var best_for = item.best_for || {};
    if (typeof best_for === "string") best_for = { zh: best_for, en: best_for };

    var lang = item.lang;
    if (typeof lang === "string") lang = [lang];
    if (!Array.isArray(lang)) lang = [];

    var media = item.media || null;
    if (media && media.youtube_video_id && !media.thumbnail_url) {
      media.thumbnail_url = "https://img.youtube.com/vi/" + media.youtube_video_id + "/hqdefault.jpg";
    }

    return {
      id: id,
      title: title,
      source: item.source || "",
      url: item.url || "",
      type: item.type || "article",
      card_kind: item.card_kind || "resource",
      lang: lang,
      level: item.level || "beginner",
      audience_level: item.audience_level || "",
      career_stage: item.career_stage || "",
      track: item.track || "",
      category: item.category || item.track || "",
      scope: item.scope || "",
      summary: summary,
      impact: impact,
      best_for: best_for,
      tags: item.tags || [],
      featured: !!item.featured,
      home_featured: !!item.home_featured,
      priority: typeof item.priority === "number" ? item.priority : 99,
      verified_date: item.verified_date || null,
      note: item.note || "",
      notes: item.notes || null,
      year: item.year || null,
      media: media
    };
  }

  /* ==========================================================================
   * i18n helper
   * ========================================================================== */

  function t(key) {
    if (typeof I18n !== "undefined" && I18n.t) return I18n.t(key);
    return key;
  }

  function localized(obj, lang) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj[lang] || obj["zh"] || obj["en"] || "";
  }

  /* ==========================================================================
   * Filters
   * ========================================================================== */

  function getFilters(items) {
    var tracks = {};
    var types = {};
    var levels = {};
    var langs = {};

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.track) tracks[item.track] = true;
      if (item.type) types[item.type] = true;
      if (item.level) levels[item.level] = true;
      if (item.lang) {
        for (var j = 0; j < item.lang.length; j++) {
          langs[item.lang[j]] = true;
        }
      }
    }

    return {
      tracks: sortTracks(Object.keys(tracks)),
      types: Object.keys(types).sort(),
      levels: Object.keys(levels).sort(),
      langs: Object.keys(langs).sort()
    };
  }

  function filterResources(items, filters) {
    if (!filters) return items;
    return items.filter(function (item) {
      if (filters.track && item.track !== filters.track) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.level && item.level !== filters.level) return false;
      if (filters.lang && item.lang.indexOf(filters.lang) === -1) return false;
      return true;
    });
  }

  /* ==========================================================================
   * Badge labels
   * ========================================================================== */

  function typeLabel(type) {
    var map = {
      "article": "Article",
      "official-doc": "Official Doc",
      "course": "Course",
      "tutorial": "Tutorial",
      "video": "Video",
      "book": "Book",
      "tool": "Tool",
      "reference": "Reference",
      "community": "Community"
    };
    return map[type] || type;
  }

  function levelLabel(level) {
    var map = {
      "beginner": "Beginner",
      "intermediate": "Intermediate",
      "advanced": "Advanced",
      "reference": "Reference"
    };
    return map[level] || level;
  }

  /* ==========================================================================
   * Group & Sort
   * ========================================================================== */

  var AUDIENCE_ORDER = ["先看懂大概", "补一个卡住的概念", "看真实例子前准备一下", "查资料", "查阅型资料"];

  var TRACK_ORDER = {
    "automation": 10,
    "semiconductor-equipment": 20,
    "robotics": 30,
    "energy": 40,
    "manufacturing": 50,
    "cpp": 110,
    "python": 120,
    "linux": 130,
    "git": 140,
    "plc": 150,
    "microcontrollers": 160,
    "sensors": 170,
    "math": 210,
    "physics": 220,
    "circuits": 230,
    "programming": 240,
    "control": 250,
    "measurement": 260,
    "electronics": 231,
    "signals-control": 251
  };

  function sortTracks(trackIds) {
    return trackIds.sort(function (a, b) {
      var oa = TRACK_ORDER[a] != null ? TRACK_ORDER[a] : 999;
      var ob = TRACK_ORDER[b] != null ? TRACK_ORDER[b] : 999;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
  }

  var LANG_ORDER = { "en": 0, "de": 1, "zh": 2, "multi": 3 };

  var TYPE_ORDER = {
    "video": 0,
    "course": 1,
    "tutorial": 2,
    "article": 3,
    "book": 4,
    "official-doc": 5,
    "reference": 6
  };

  function groupByAudience(items) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var lvl = items[i].audience_level || "查阅型资料";
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(items[i]);
    }
    /* Sort each group: lang > type > priority */
    for (var key in groups) {
      if (groups.hasOwnProperty(key)) {
        groups[key].sort(function (a, b) {
          var la = LANG_ORDER[a.lang[0]] != null ? LANG_ORDER[a.lang[0]] : 9;
          var lb = LANG_ORDER[b.lang[0]] != null ? LANG_ORDER[b.lang[0]] : 9;
          if (la !== lb) return la - lb;
          var ta = TYPE_ORDER[a.type] != null ? TYPE_ORDER[a.type] : 9;
          var tb = TYPE_ORDER[b.type] != null ? TYPE_ORDER[b.type] : 9;
          if (ta !== tb) return ta - tb;
          return a.priority - b.priority;
        });
      }
    }
    return groups;
  }

  /* ==========================================================================
   * Render: media thumbnail / placeholder
   * ========================================================================== */

  function renderMedia(item, overlayHtml) {
    var url = item.url;
    var hasUrl = safeUrl(url);
    var media = item.media;
    var h = "";

    if (!media) return "";

    var thumbUrl = media.thumbnail_url || "";

    if (thumbUrl) {
      var img = '<img class="resource-media-img" src="' + attr(thumbUrl) +
        '" alt="' + esc(localized(item.title, "zh")) +
        '" loading="lazy">';
      if (hasUrl) {
        h += '<a class="resource-media-link" href="' + attr(url) +
          '" target="_blank" rel="noreferrer noopener">' + img + '</a>';
      } else {
        h += '<div class="resource-media-link disabled">' + img + '</div>';
      }
    } else {
      /* Fallback placeholder */
      var label = (media.type === "youtube-channel") ? "YouTube Channel" :
                  (media.type === "youtube-playlist") ? "YouTube Playlist" : "Video";
      var icon = '<span class="resource-video-icon">&#9654;</span>';
      var placeholder = '<div class="resource-video-placeholder">' + icon +
        '<span class="resource-video-label">' + esc(label) + '</span></div>';
      if (hasUrl) {
        h += '<a class="resource-media-link resource-media-placeholder-link" href="' + attr(url) +
          '" target="_blank" rel="noreferrer noopener">' + placeholder + '</a>';
      } else {
        h += '<div class="resource-media-link disabled">' + placeholder + '</div>';
      }
    }

    return '<div class="resource-media">' + h + (overlayHtml || "") + '</div>';
  }

  /* ==========================================================================
   * Render: single resource card
   * ========================================================================== */

  function renderResourceCard(item, lang) {
    lang = lang || "zh";
    var hasUrl = safeUrl(item.url);

    /* Use <article> — never wrap whole card in <a> */
    var h = '<article class="resource-card">';

    /* Media / thumbnail */
    var mediaAction = "";
    if (hasUrl) {
      mediaAction = '<a class="resource-media-action" href="' + attr(item.url) +
        '" target="_blank" rel="noreferrer noopener">' + esc(t("direct_link")) + '</a>';
    }
    h += renderMedia(item, mediaAction);

    /* Body */
    h += '<div class="resource-card-body">';

    /* Title + source */
    h += '<div class="resource-card-header">';
    h += '<h3 class="resource-card-title">' + esc(localized(item.title, lang)) + '</h3>';
    if (item.source) {
      h += '<span class="resource-card-source">' + esc(item.source) + '</span>';
    }
    h += '</div>';

    /* Meta badges */
    h += '<div class="resource-card-meta">';
    h += '<span class="resource-badge resource-badge-type">' + esc(typeLabel(item.type)) + '</span>';
    h += '<span class="resource-badge resource-badge-level">' + esc(levelLabel(item.level)) + '</span>';
    if (item.lang && item.lang.length > 0) {
      h += '<span class="resource-badge resource-badge-lang">' + esc(item.lang.join("/").toUpperCase()) + '</span>';
    }
    if (item.career_stage) {
      h += '<span class="resource-badge resource-badge-career">' + esc(item.career_stage) + '</span>';
    }
    h += '</div>';

    /* Summary — one short line */
    var sum = localized(item.summary, lang);
    if (sum) {
      h += '<p class="resource-card-summary">' + esc(sum) + '</p>';
    }

    /* Tags */
    if (item.tags && item.tags.length > 0) {
      h += '<div class="resource-card-tags">';
      for (var ti = 0; ti < item.tags.length; ti++) {
        h += '<span class="resource-tag">' + esc(item.tags[ti]) + '</span>';
      }
      h += '</div>';
    }

    /* Footer: verified date + direct link */
    if (item.notes) {
      h += '<div class="resource-card-actions">';
      h += renderNoteButton(item, lang);
      h += '</div>';
    } else if (!hasUrl) {
      h += '<div class="resource-card-footer">';
      h += '<span class="resource-direct-link disabled">' + esc(t("pending_verify")) + '</span>';
      h += '</div>';
    }

    h += '</div>'; /* /.resource-card-body */
    h += '</article>'; /* /.resource-card */

    return h;
  }

  /* ==========================================================================
   * Render: resource page with audience_level groups
   * ========================================================================== */

  function renderResourcePage(data, options) {
    var opts = options || {};
    var lang = opts.lang || "zh";
    var filters = opts.filters || {};
    var items = normalizeResources(data);
    var availableFilters = getFilters(items);
    var filtered = filterResources(items, filters);

    var h = '<div class="resource-page">';

    /* Filter bar */
    h += renderFilterBar(filters, availableFilters);

    if (filtered.length === 0) {
      h += '<div class="resource-empty"><p>' + esc(t("search_no_results")) + '</p></div>';
    } else {
      /* Group by audience_level */
      var groups = groupByAudience(filtered);

      var renderedGroups = {};
      function renderGroup(groupKey) {
        var groupItems = groups[groupKey];
        if (!groupItems || groupItems.length === 0) return;
        renderedGroups[groupKey] = true;

        h += '<section class="resource-group">';
        h += '<h2 class="resource-group-title">' + esc(groupKey) + '</h2>';
        h += '<p class="resource-group-desc">' + groupItems.length + ' ' + esc(t("resource_count")) + '</p>';
        h += '<div class="resource-grid">';
        for (var ri = 0; ri < groupItems.length; ri++) {
          h += renderResourceCard(groupItems[ri], lang);
        }
        h += '</div></section>';
      }

      for (var gi = 0; gi < AUDIENCE_ORDER.length; gi++) {
        renderGroup(AUDIENCE_ORDER[gi]);
      }

      var extraGroups = Object.keys(groups).filter(function (groupKey) {
        return !renderedGroups[groupKey];
      }).sort();
      for (var eg = 0; eg < extraGroups.length; eg++) {
        renderGroup(extraGroups[eg]);
      }
    }

    /* Timeline table at bottom of resource page */
    h += renderTimelineTable(items, lang);

    h += '</div>'; /* /.resource-page */
    return h;
  }

  /* ==========================================================================
   * Filter bar
   * ========================================================================== */

  function filterChip(label, value, currentValue, filterKey) {
    var active = value === currentValue ? ' active' : '';
    var chipValue = value || "";
    return '<button class="resource-filter-chip' + active +
      '" data-filter="' + esc(filterKey) +
      '" data-value="' + esc(chipValue) + '">' + esc(label) + '</button>';
  }

  function renderFilterBar(filters, available) {
    var trackNames = {
      "automation": "Automation",
      "semiconductor-equipment": "Semiconductor Equipment",
      "robotics": "Robotics",
      "energy": "Energy",
      "manufacturing": "Manufacturing",
      "cpp": "C++",
      "python": "Python",
      "linux": "Linux",
      "git": "Git",
      "plc": "PLC",
      "microcontrollers": "Microcontrollers",
      "sensors": "Sensors",
      "math": "Math",
      "physics": "Physics",
      "circuits": "Circuits",
      "programming": "Programming",
      "control": "Control",
      "measurement": "Measurement",
      "electronics": "Electronics",
      "signals-control": "Signals & Control"
    };

    var h = '<div class="resource-filter-bar">';

    /* Track */
    h += '<div class="resource-filter-group">';
    h += '<span class="resource-filter-label">' + esc(t("filter_track")) + '</span>';
    h += filterChip("All", "", filters.track, "track");
    for (var ti = 0; ti < available.tracks.length; ti++) {
      var tr = available.tracks[ti];
      h += filterChip(trackNames[tr] || tr, tr, filters.track, "track");
    }
    h += '</div>';

    /* Type */
    h += '<div class="resource-filter-group">';
    h += '<span class="resource-filter-label">' + esc(t("filter_type")) + '</span>';
    h += filterChip("All", "", filters.type, "type");
    for (var yi = 0; yi < available.types.length; yi++) {
      var tp = available.types[yi];
      h += filterChip(typeLabel(tp), tp, filters.type, "type");
    }
    h += '</div>';

    /* Level */
    h += '<div class="resource-filter-group">';
    h += '<span class="resource-filter-label">' + esc(t("filter_level")) + '</span>';
    h += filterChip("All", "", filters.level, "level");
    for (var li = 0; li < available.levels.length; li++) {
      var lv = available.levels[li];
      h += filterChip(levelLabel(lv), lv, filters.level, "level");
    }
    h += '</div>';

    /* Lang */
    h += '<div class="resource-filter-group">';
    h += '<span class="resource-filter-label">' + esc(t("filter_lang")) + '</span>';
    h += filterChip("All", "", filters.lang, "lang");
    for (var gi = 0; gi < available.langs.length; gi++) {
      var ln = available.langs[gi];
      h += filterChip(ln.toUpperCase(), ln, filters.lang, "lang");
    }
    h += '</div>';

    /* Clear */
    var hasFilters = filters.track || filters.type || filters.level || filters.lang;
    if (hasFilters) {
      h += '<button class="resource-clear-filters" data-filter="clear">' + esc(t("clear_filters")) + '</button>';
    }

    h += '</div>'; /* /.resource-filter-bar */
    return h;
  }

  /* ==========================================================================
   * Featured resources (for home page)
   * ========================================================================== */

  function renderResourceHighlights(data, lang, limit) {
    if (!data) return "";
    var items = normalizeResources(data);
    var featured = items.filter(function (item) {
      return item.featured && item.scope === "engineering-terms";
    });

    featured.sort(function (a, b) { return a.priority - b.priority; });
    featured = featured.slice(0, limit || 4);

    if (featured.length === 0) return "";

    var h = '<h2>' + esc(t("featured_resources")) + '</h2>';
    h += '<div class="featured-resources">';
    for (var i = 0; i < featured.length; i++) {
      var item = featured[i];
      var hasUrl = safeUrl(item.url);

      h += '<article class="resource-card resource-card-compact">';
      h += renderMedia(item);
      h += '<div class="resource-card-body">';
      h += '<h4>' + esc(localized(item.title, lang)) + '</h4>';
      if (item.source) {
        h += '<span class="resource-card-source">' + esc(item.source) + '</span>';
      }
      var sum = localized(item.summary, lang);
      if (sum) {
        h += '<p>' + esc(sum) + '</p>';
      }
      if (item.tags && item.tags.length > 0) {
        h += '<div class="resource-card-tags">';
        for (var ti = 0; ti < Math.min(item.tags.length, 3); ti++) {
          h += '<span class="resource-tag">' + esc(item.tags[ti]) + '</span>';
        }
        h += '</div>';
      }
      if (hasUrl) {
        h += '<a class="resource-direct-link" href="' + attr(item.url) +
          '" target="_blank" rel="noreferrer noopener">' + esc(t("direct_link")) + '</a>';
      }
      h += '</div></article>';
    }
    h += '</div>';

    h += '<p style="margin-top:1em;"><a href="#/resources">' + esc(t("resources")) + ' →</a></p>';

    return h;
  }

  /* ==========================================================================
   * Related resources (for category pages)
   * ========================================================================== */

  function renderRelatedResources(data, category, lang, limit) {
    if (!data || !category) return "";
    var items = normalizeResources(data);
    var related = items.filter(function (item) {
      return item.category === category || item.track === category;
    });

    related.sort(function (a, b) { return a.priority - b.priority; });
    related = related.slice(0, limit || 3);

    if (related.length === 0) return "";

    var h = '<h3>' + esc(t("related_resources")) + '</h3>';
    h += '<div class="related-resources">';
    for (var i = 0; i < related.length; i++) {
      var item = related[i];
      var hasUrl = safeUrl(item.url);

      h += '<article class="resource-card resource-card-compact">';
      h += '<h4>' + esc(localized(item.title, lang)) + '</h4>';
      if (item.source) {
        h += '<span class="resource-card-source">' + esc(item.source) + '</span>';
      }
      var sum = localized(item.summary, lang);
      if (sum) {
        h += '<p>' + esc(sum) + '</p>';
      }
      if (hasUrl) {
        h += '<a class="resource-direct-link" href="' + attr(item.url) +
          '" target="_blank" rel="noreferrer noopener">' + esc(t("direct_link")) + '</a>';
      }
      h += '</article>';
    }
    h += '</div>';

    return h;
  }

  /* ==========================================================================
   * Home page: Featured Videos grid
   * ========================================================================== */

  function renderHomeVideoGrid(data, lang) {
    var items = normalizeResources(data);
    var videos = items.filter(function (item) {
      return item.scope === "engineering-terms" && item.home_featured;
    });
    videos.sort(function (a, b) { return a.priority - b.priority; });

    if (videos.length === 0) return "";

    var h = '<section class="home-section">';
    h += '<h2 class="home-section-title">' + esc(t("foundation_featured_videos")) + '</h2>';
    h += '<div class="home-video-grid">';
    for (var i = 0; i < videos.length; i++) {
      h += renderHomeVideoCard(videos[i], lang);
    }
    h += '</div></section>';
    return h;
  }

  function renderHomeResourceSections(data, lang) {
    var items = normalizeResources(data).filter(function (item) {
      return item.scope === "engineering-terms" && item.home_featured;
    });
    items.sort(function (a, b) { return a.priority - b.priority; });

    var sections = [
      {
        title: lang === "en" ? "Industry Directions" : "产业方向",
        tracks: ["automation", "semiconductor-equipment", "robotics", "energy", "manufacturing"]
      },
      {
        title: lang === "en" ? "Engineering Skills" : "工程技能",
        tracks: ["cpp", "python", "linux", "git", "plc", "microcontrollers", "sensors"],
        note: lang === "en"
          ? "Difficulty: ★ 0-1y · ★★ 1-3y · ★★★ 3-5y · ★★★★ 5y+ · ★★★★★ expert"
          : "难度：★ 0-1 年 · ★★ 1-3 年 · ★★★ 3-5 年 · ★★★★ 5 年+ · ★★★★★ 专家级"
      },
      {
        title: lang === "en" ? "Foundations" : "学科基础",
        tracks: ["math", "physics", "circuits", "programming", "control", "measurement"]
      }
    ];

    var h = "";
    for (var si = 0; si < sections.length; si++) {
      var section = sections[si];
      var sectionItems = items.filter(function (item) {
        return section.tracks.indexOf(item.track) !== -1;
      });
      if (sectionItems.length === 0) continue;

      h += '<section class="home-section home-resource-section">';
      h += '<h2 class="home-resource-section-title">' + esc(section.title) + '</h2>';
      if (section.note) {
        h += '<p class="home-resource-section-note">' + esc(section.note) + '</p>';
      }
      h += '<div class="home-video-grid">';
      for (var i = 0; i < sectionItems.length; i++) {
        h += renderHomeVideoCard(sectionItems[i], lang);
      }
      h += '</div></section>';
    }
    return h;
  }

  function renderHomeVideoCard(item, lang) {
    var hasUrl = safeUrl(item.url);
    var h = '<article class="home-video-card">';
    h += renderMedia(item);
    h += '<div class="home-card-body">';
    h += '<h3 class="home-card-title">' + esc(localized(item.title, lang)) + '</h3>';
    if (item.source) {
      h += '<span class="home-card-source">' + esc(item.source) + '</span>';
    }
    if (item.career_stage) {
      h += '<div class="home-card-career-stage">' + esc(item.career_stage) + '</div>';
    }
    var sum = localized(item.summary, lang);
    if (sum) {
      h += '<p class="home-card-summary">' + esc(sum) + '</p>';
    }
    if (hasUrl || item.notes) {
      h += '<div class="home-card-actions">';
    }
    if (hasUrl) {
      h += '<a class="resource-direct-link" href="' + attr(item.url) +
        '" target="_blank" rel="noreferrer noopener">' + esc(t("direct_link")) + '</a>';
    }
    if (item.notes) {
      h += renderNoteButton(item, lang);
    }
    if (hasUrl || item.notes) {
      h += '</div>';
    }
    h += '</div></article>';
    return h;
  }

  /* ==========================================================================
   * Home page: Timeline TABLE
   * ========================================================================== */

  function renderHomeTimeline(data, lang) {
    var items = normalizeResources(data);
    var events = items.filter(function (item) {
      return item.card_kind === "event" && item.track === "foundation" && item.home_featured;
    });
    events.sort(function (a, b) { return (b.year || 0) - (a.year || 0); });

    if (events.length === 0) return "";

    var h = '<section class="home-section">';
    h += '<h2 class="home-section-title">' + esc(t("foundation_timeline")) + '</h2>';
    h += '<div class="home-timeline-wrap"><table class="home-timeline-table"><thead><tr>' +
      '<th>' + esc(t("year")) + '</th>' +
      '<th>' + esc(t("key_event")) + '</th>' +
      '<th>' + esc(t("industry_impact")) + '</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      var hasUrl = safeUrl(item.url);
      var year = item.year || "";
      var title = localized(item.title, lang);
      var impactText = localized(item.impact, lang) || localized(item.summary, lang);

      h += '<tr>';
      h += '<td class="timeline-year-cell"><strong>' + esc(String(year)) + '</strong></td>';
      h += '<td class="timeline-event-cell">';
      if (hasUrl) {
        h += '<a href="' + attr(item.url) + '" target="_blank" rel="noreferrer noopener">' + esc(title) + '</a>';
      } else {
        h += esc(title);
      }
      h += '</td>';
      h += '<td class="timeline-impact-cell">' + esc(impactText) + '</td>';
      h += '</tr>';
    }

    h += '</tbody></table></div></section>';
    return h;
  }

  /* ==========================================================================
   * Home page: People / Organizations / Works
   * ========================================================================== */

  function renderHomePeopleOrgWork(data, lang) {
    var items = normalizeResources(data);
    var people = items.filter(function (item) {
      return item.card_kind === "person" && item.home_featured;
    });
    var orgs = items.filter(function (item) {
      return item.card_kind === "organization" && item.home_featured;
    });
    var works = items.filter(function (item) {
      return item.card_kind === "work" && item.home_featured;
    });
    people.sort(function (a, b) { return a.priority - b.priority; });
    orgs.sort(function (a, b) { return a.priority - b.priority; });
    works.sort(function (a, b) { return a.priority - b.priority; });

    if (people.length === 0 && orgs.length === 0 && works.length === 0) return "";

    var h = '<section class="home-section">';
    h += '<h2 class="home-section-title">' + esc(t("foundation_people_org_works")) + '</h2>';

    /* People */
    if (people.length > 0) {
      h += '<h3 class="home-subsection-title">' + esc(t("people")) + '</h3>';
      h += '<div class="home-mini-grid">';
      for (var i = 0; i < people.length; i++) {
        h += renderMiniCard(people[i], lang);
      }
      h += '</div>';
    }

    /* Organizations */
    if (orgs.length > 0) {
      h += '<h3 class="home-subsection-title">' + esc(t("organizations")) + '</h3>';
      h += '<div class="home-mini-grid">';
      for (var j = 0; j < orgs.length; j++) {
        h += renderMiniCard(orgs[j], lang);
      }
      h += '</div>';
    }

    /* Works */
    if (works.length > 0) {
      h += '<h3 class="home-subsection-title">' + esc(t("works")) + '</h3>';
      h += '<div class="home-mini-grid">';
      for (var k = 0; k < works.length; k++) {
        h += renderMiniCard(works[k], lang);
      }
      h += '</div>';
    }

    h += '</section>';
    return h;
  }

  function renderMiniCard(item, lang) {
    var hasUrl = safeUrl(item.url);
    var h = '<article class="mini-card">';
    if (hasUrl) {
      h += '<a class="mini-card-link" href="' + attr(item.url) +
        '" target="_blank" rel="noreferrer noopener">';
      h += '<span class="mini-card-title">' + esc(localized(item.title, lang)) + '</span>';
      h += '</a>';
    } else {
      h += '<span class="mini-card-title">' + esc(localized(item.title, lang)) + '</span>';
    }
    var sum = localized(item.summary, lang);
    if (sum) {
      h += '<p class="mini-card-summary">' + esc(sum) + '</p>';
    }
    h += '</article>';
    return h;
  }

  /* ==========================================================================
   * Timeline table (shared by home and resources page)
   * ========================================================================== */

  function renderTimelineTable(items, lang) {
    var events = items.filter(function (item) {
      return item.card_kind === "event" && item.track === "foundation" && item.home_featured;
    });
    events.sort(function (a, b) { return (b.year || 0) - (a.year || 0); });

    if (events.length === 0) return "";

    var h = '<section class="home-section">';
    h += '<h2 class="home-section-title">' + esc(t("foundation_timeline")) + '</h2>';
    h += '<div class="home-timeline-wrap"><table class="home-timeline-table"><thead><tr>' +
      '<th>' + esc(t("year")) + '</th>' +
      '<th>' + esc(t("key_event")) + '</th>' +
      '<th>' + esc(t("industry_impact")) + '</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < events.length; i++) {
      var item = events[i];
      var hasUrl = safeUrl(item.url);
      var year = item.year || "";
      var title = localized(item.title, lang);
      var impactText = localized(item.impact, lang) || localized(item.summary, lang);

      h += '<tr>';
      h += '<td class="timeline-year-cell"><strong>' + esc(String(year)) + '</strong></td>';
      h += '<td class="timeline-event-cell">';
      if (hasUrl) {
        h += '<a href="' + attr(item.url) + '" target="_blank" rel="noreferrer noopener">' + esc(title) + '</a>';
      } else {
        h += esc(title);
      }
      h += '</td>';
      h += '<td class="timeline-impact-cell">' + esc(impactText) + '</td>';
      h += '</tr>';
    }

    h += '</tbody></table></div></section>';
    return h;
  }

  /* ==========================================================================
   * Thumbnail helper
   * ========================================================================== */

  function getThumbnail(item) {
    if (!item || !item.media) return "";
    return item.media.thumbnail_url || "";
  }

  /* ==========================================================================
   * Direct link renderer
   * ========================================================================== */

  function renderDirectLink(item) {
    if (!safeUrl(item.url)) return "";
    return '<a class="resource-direct-link" href="' + attr(item.url) +
      '" target="_blank" rel="noreferrer noopener">' + esc(t("direct_link")) + '</a>';
  }

  function renderNoteButton(item, lang) {
    if (!item.notes) return "";
    var payload = encodeURIComponent(JSON.stringify(item.notes));
    var label = lang === "en" ? "Notes" : "理解笔记";
    return '<button class="resource-note-link" type="button" data-resource-note="' +
      attr(payload) + '">' + esc(label) + '</button>';
  }

  /* ==========================================================================
   * Public API
   * ========================================================================== */

  return {
    normalizeResources: normalizeResources,
    getFilters: getFilters,
    filterResources: filterResources,
    renderResourcePage: renderResourcePage,
    renderResourceCard: renderResourceCard,
    renderResourceHighlights: renderResourceHighlights,
    renderRelatedResources: renderRelatedResources,
    renderHomeVideoGrid: renderHomeVideoGrid,
    renderHomeResourceSections: renderHomeResourceSections,
    renderHomeTimeline: renderHomeTimeline,
    renderHomePeopleOrgWork: renderHomePeopleOrgWork,
    renderTimelineTable: renderTimelineTable,
    getThumbnail: getThumbnail,
    renderDirectLink: renderDirectLink,
    esc: esc,
    attr: attr,
    safeUrl: safeUrl
  };
})();
