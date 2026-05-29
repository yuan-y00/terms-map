/*
 * 术语地图 — Markdown Renderer
 * ============================================================================
 * Self-contained Markdown-to-HTML renderer. No external dependencies.
 * - Frontmatter stripping
 * - Headings h1-h4 with id generation for h2/h3
 * - Paragraphs, lists, blockquotes, code blocks, tables
 * - Inline formatting: bold, italic, code, links, images
 * - XSS-safe: all text HTML-escaped, URLs validated
 * - TOC generation from h2/h3
 * - Relative image and .md link rewriting
 */

var MarkdownRenderer = (function () {

  /* ==========================================================================
   * HTML Safety
   * ========================================================================== */

  function escHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(url) {
    if (!url) return false;
    var trimmed = String(url).trim();
    var lower = trimmed.toLowerCase();
    if (lower.startsWith("javascript:")) return false;
    if (lower.startsWith("data:text/html")) return false;
    if (lower.startsWith("data:") && !lower.startsWith("data:image/")) return false;
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/^mailto:/i.test(trimmed)) return true;
    if (/^#/.test(trimmed)) return true;
    if (/^\/\//.test(trimmed)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
    return true;
  }

  /* ==========================================================================
   * Path Resolution
   * ========================================================================== */

  function resolveRelativePath(docPath, href) {
    var dir = docPath.replace(/[^\/]*$/, "");
    var rel = href.replace(/^\.\//, "");
    var dirParts = dir.split("/").filter(function (p) { return p !== ""; });
    var relParts = rel.split("/");
    for (var i = 0; i < relParts.length; i++) {
      var part = relParts[i];
      if (part === "..") {
        if (dirParts.length > 0) dirParts.pop();
      } else if (part !== ".") {
        dirParts.push(part);
      }
    }
    return dirParts.join("/");
  }

  function resolveImageUrl(src, docPath) {
    if (!docPath) return src;
    if (/^https?:\/\//i.test(src)) return src;
    if (/^data:/i.test(src)) return src;
    if (/^\/\//.test(src)) return src;
    var resolved = resolveRelativePath(docPath, src);
    return (CONFIG.contentBase || "").replace(/\/+$/, "") + "/" + resolved;
  }

  function resolveLinkUrl(href, docPath, manifest) {
    if (!docPath) return href;
    if (/^https?:\/\//i.test(href)) return href;
    if (/^mailto:/i.test(href)) return href;
    if (/^#/.test(href)) return href;
    if (/^\/\//.test(href)) return href;
    var resolved = resolveRelativePath(docPath, href);
    if (/\.md$/i.test(resolved) && manifest && manifest.docs) {
      for (var i = 0; i < manifest.docs.length; i++) {
        if (manifest.docs[i].path === resolved) return "#/doc/" + manifest.docs[i].id;
      }
    }
    return (CONFIG.contentBase || "").replace(/\/+$/, "") + "/" + resolved;
  }

  /* ==========================================================================
   * Frontmatter
   * ========================================================================== */

  function stripFrontmatter(markdown) {
    if (!markdown) return { body: "", frontmatterRaw: "" };
    var trimmed = markdown.replace(/^﻿/, "").replace(/\r\n/g, "\n");
    if (trimmed.indexOf("---\n") !== 0) {
      /* Also check for --- followed by nothing else on the line */
      if (trimmed.indexOf("---") !== 0) return { body: markdown, frontmatterRaw: "" };
    }
    var rest = trimmed.substring(trimmed.indexOf("\n") + 1);
    var closeIdx = rest.indexOf("\n---");
    if (closeIdx === -1) return { body: markdown, frontmatterRaw: "" };
    var fm = rest.substring(0, closeIdx);
    /* Skip past \n--- and the following \n */
    var bodyStart = rest.indexOf("\n", closeIdx + 1);
    if (bodyStart === -1) bodyStart = closeIdx + 4;
    var body = rest.substring(bodyStart).replace(/^\n+/, "");
    return { body: body, frontmatterRaw: "---\n" + fm + "\n---" };
  }

  /* ==========================================================================
   * Heading slug
   * ========================================================================== */

  function slugifyHeading(text, usedSlugs) {
    if (!text || typeof text !== "string") return "heading";
    var slug = text.trim().toLowerCase()
      .replace(/[\s]+/g, "-")
      .replace(/[，。！？、；：""''（）【】《》…—・,\.!\?;:'"\(\)\[\]{}<>@#$%^&*+=~`|\\\/]+/g, "")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    if (!slug) { slug = "heading-" + ((usedSlugs._counter || 0) + 1); usedSlugs._counter = (usedSlugs._counter || 0) + 1; }
    var base = slug, count = 1;
    while (usedSlugs[slug]) { count++; slug = base + "-" + count; }
    usedSlugs[slug] = true;
    return slug;
  }

  /* ==========================================================================
   * Inline formatting
   * ========================================================================== */

  function parseInline(text) {
    var html = escHtml(text);

    /* Inline code — protect first */
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    /* Bold **text** */
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    /* Italic *text* — single asterisk, not double */
    html = html.replace(/(^|[^*])\*([^*]+)\*($|[^*])/g, "$1<em>$2</em>$3");

    /* Images ![alt](url) */
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (m, alt, url) {
      if (!safeUrl(url)) return m;
      return '<img src="' + escHtml(url) + '" alt="' + escHtml(alt) + '" loading="lazy">';
    });

    /* Links [text](url) */
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, text, url) {
      if (!safeUrl(url)) return m;
      var isExt = /^https?:\/\//i.test(url);
      var attrs = 'href="' + escHtml(url) + '"';
      if (isExt) attrs += ' target="_blank" rel="noreferrer noopener"';
      return "<a " + attrs + ">" + text + "</a>";
    });

    return html;
  }

  /* ==========================================================================
   * Block-level parsing
   * ========================================================================== */

  function renderBlocks(body, doc, manifest, usedSlugs) {
    /* Normalize line endings */
    body = body.replace(/\r\n/g, "\n");

    /* Step 1: extract fenced code blocks and replace with placeholders */
    var codeBlocks = [];
    var text = body.replace(/```(\w*)\s*\n([\s\S]*?)```/g, function (m, lang, code) {
      var idx = codeBlocks.length;
      var escaped = escHtml(code.replace(/\n$/, ""));
      codeBlocks.push('<pre><code class="language-' + escHtml(lang || "") + '">' + escaped + "</code></pre>");
      return "\x00CODE" + idx + "\x00";
    });

    /* Step 2: split into blocks by blank lines */
    var rawBlocks = text.split(/\n{2,}/);
    var html = "";

    for (var b = 0; b < rawBlocks.length; b++) {
      var block = rawBlocks[b].trim();
      if (!block) continue;

      /* Restore code placeholder */
      if (/^\x00CODE\d+\x00$/.test(block)) {
        var ci = parseInt(block.replace(/\x00CODE(\d+)\x00/, "$1"), 10);
        html += codeBlocks[ci] + "\n";
        continue;
      }

      var firstLine = block.split("\n")[0].trim();

      /* Trusted rich blocks authored in local docs */
      if (/^<(section|div)\s+class="term-map/.test(firstLine)) {
        html += block + "\n";
        continue;
      }

      /* Heading */
      var hMatch = firstLine.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch && block.indexOf("\n") === -1) {
        var level = hMatch[1].length;
        var hText = parseInline(hMatch[2]);
        var id = "";
        if (level === 2 || level === 3) {
          id = slugifyHeading(hMatch[2].replace(/\*|_|`|\[|\]|\(|\)/g, ""), usedSlugs);
        }
        html += "<h" + level + (id ? ' id="' + id + '"' : "") + ">" + hText + "</h" + level + ">\n";
        continue;
      }

      /* HR */
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(firstLine) && block.indexOf("\n") === -1) {
        html += "<hr>\n";
        continue;
      }

      /* Table: contains | and at least one separator row */
      if (block.indexOf("|") !== -1) {
        var lines = block.split("\n");
        if (lines.length >= 2 && lines[1] && /\|[\s\-:]+\|/.test(lines[1])) {
          html += renderTable(lines) + "\n";
          continue;
        }
      }

      /* Blockquote */
      if (firstLine.indexOf(">") === 0) {
        var qLines = block.split("\n");
        var qContent = "";
        for (var qi = 0; qi < qLines.length; qi++) {
          qContent += (qContent ? "\n" : "") + qLines[qi].replace(/^>\s?/, "");
        }
        html += "<blockquote>" + parseInline(qContent) + "</blockquote>\n";
        continue;
      }

      /* Unordered list */
      if (/^[-*+]\s/.test(firstLine)) {
        var ulines = block.split("\n");
        html += "<ul>\n";
        for (var ui = 0; ui < ulines.length; ui++) {
          var item = ulines[ui].replace(/^[-*+]\s/, "");
          html += "<li>" + parseInline(item) + "</li>\n";
        }
        html += "</ul>\n";
        continue;
      }

      /* Ordered list */
      if (/^\d+\.\s/.test(firstLine)) {
        var olines = block.split("\n");
        html += "<ol>\n";
        for (var oi = 0; oi < olines.length; oi++) {
          var oitem = olines[oi].replace(/^\d+\.\s/, "");
          html += "<li>" + parseInline(oitem) + "</li>\n";
        }
        html += "</ol>\n";
        continue;
      }

      /* Paragraph */
      html += "<p>" + parseInline(block.replace(/\n/g, " ")) + "</p>\n";
    }

    return html;
  }

  function renderTable(lines) {
    var h = "<table>\n<thead>\n<tr>\n";
    var headerCells = lines[0].split("|").filter(function (c) { return c.trim() !== ""; });
    for (var i = 0; i < headerCells.length; i++) {
      h += "<th>" + parseInline(headerCells[i].trim()) + "</th>\n";
    }
    h += "</tr>\n</thead>\n<tbody>\n";
    for (var r = 2; r < lines.length; r++) {
      var cells = lines[r].split("|").filter(function (c) { return c.trim() !== ""; });
      if (cells.length === 0) continue;
      h += "<tr>\n";
      for (var c = 0; c < cells.length; c++) {
        h += "<td>" + parseInline(cells[c].trim()) + "</td>\n";
      }
      h += "</tr>\n";
    }
    h += "</tbody>\n</table>\n";
    return h;
  }

  /* ==========================================================================
   * TOC generation
   * ========================================================================== */

  function buildToc(html) {
    var toc = [];
    var regex = /<h([23])\s[^>]*id\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/h[23]>/gi;
    var match;
    while ((match = regex.exec(html)) !== null) {
      toc.push({
        level: parseInt(match[1], 10),
        id: match[2],
        text: match[3].replace(/<[^>]*>/g, "").trim()
      });
    }
    return toc;
  }

  /* ==========================================================================
   * URL rewriting helpers (used as fallback / enhancement)
   * ========================================================================== */

  function rewriteImageUrls(html, docPath) {
    if (!docPath) return html;
    return html.replace(/<img\s[^>]*src\s*=\s*"([^"]*)"/gi, function (full, src) {
      if (/^https?:\/\//i.test(src)) return full;
      if (/^data:/i.test(src)) return full;
      if (/^\/\//.test(src)) return full;
      var resolved = resolveRelativePath(docPath, src);
      var newSrc = (CONFIG.contentBase || "").replace(/\/+$/, "") + "/" + resolved;
      return full.replace('src="' + src + '"', 'src="' + newSrc + '"');
    });
  }

  function rewriteMarkdownLinks(html, docPath, manifest) {
    if (!docPath) return html;
    return html.replace(/<a\s([^>]*)href\s*=\s*"([^"]*)"/gi, function (full, before, href) {
      if (/^https?:\/\//i.test(href)) return full;
      if (/^mailto:/i.test(href)) return full;
      if (/^#/.test(href)) return full;
      if (/^\/\//.test(href)) return full;
      var resolved = resolveRelativePath(docPath, href);
      if (/\.md$/i.test(resolved) && manifest && manifest.docs) {
        for (var i = 0; i < manifest.docs.length; i++) {
          if (manifest.docs[i].path === resolved) {
            return full.replace('href="' + href + '"', 'href="#/doc/' + manifest.docs[i].id + '"');
          }
        }
      }
      var raw = (CONFIG.contentBase || "").replace(/\/+$/, "") + "/" + resolved;
      return full.replace('href="' + href + '"', 'href="' + raw + '"');
    });
  }

  /* ==========================================================================
   * Main render function
   * ========================================================================== */

  function renderMarkdown(markdown, doc, manifest) {
    if (!markdown) return { html: "", toc: [], body: "" };

    try {
      var stripped = stripFrontmatter(markdown);
      var body = stripped.body;
      var usedSlugs = { _counter: 0 };

      var html = renderBlocks(body, doc, manifest, usedSlugs);

      /* Rewrite image URLs for relative paths */
      if (doc && doc.path) {
        html = rewriteImageUrls(html, doc.path);
      }

      /* Rewrite .md links */
      if (doc && doc.path) {
        html = rewriteMarkdownLinks(html, doc.path, manifest);
      }

      /* Build TOC from rendered h2/h3 */
      var toc = buildToc(html);

      return { html: html, toc: toc, body: body };
    } catch (err) {
      console.error("MarkdownRenderer error:", err);
      return {
        html: '<div class="callout callout-info"><strong>Render Error</strong><br>' + escHtml(err.message || String(err)) + "</div>",
        toc: [],
        body: markdown || ""
      };
    }
  }

  /* ==========================================================================
   * Public API
   * ========================================================================== */

  return {
    stripFrontmatter: stripFrontmatter,
    slugifyHeading: slugifyHeading,
    renderMarkdown: renderMarkdown,
    buildToc: buildToc,
    rewriteMarkdownLinks: rewriteMarkdownLinks,
    rewriteImageUrls: rewriteImageUrls
  };
})();
