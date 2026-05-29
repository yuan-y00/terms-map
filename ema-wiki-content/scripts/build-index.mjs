#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Constants ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DOCS_DIR = join(ROOT, 'docs');
const DATA_DIR = join(ROOT, 'data');
const DIST_DIR = join(ROOT, 'dist');
const SITE_JSON_PATH = join(ROOT, 'site.json');

const VALID_LANGS = new Set(['zh', 'en']);
const REQUIRED_FIELDS = ['id', 'title', 'lang', 'category', 'summary', 'order'];
const ID_PATTERN = /^[a-z0-9-]+$/;

const DATA_FILES = [
  'home.zh.json',
  'home.en.json',
  'resources.json',
  'papers.json',
  'projects.json',
  'tutorials.json',
];

const VALID_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);

// --- CLI Arguments ---

const args = process.argv.slice(2);
const CHECK_MODE = args.includes('--check');
const STRICT_MODE = args.includes('--strict');

// --- Utilities ---

function parseValue(val) {
  val = val.trim();
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(s => {
      s = s.trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      return s;
    });
  }
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

function parseFrontmatter(content, filePath) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    throw new Error(`${filePath}: Frontmatter not found (file must start with ---)`);
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    throw new Error(`${filePath}: Frontmatter closing --- not found`);
  }

  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');
  const meta = {};

  for (const line of fmLines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      throw new Error(`${filePath}: Malformed frontmatter line: "${trimmed}"`);
    }
    const key = trimmed.substring(0, colonIdx).trim();
    const value = trimmed.substring(colonIdx + 1).trim();
    meta[key] = parseValue(value);
  }

  return { meta, body };
}

function extractHeadings(body) {
  const headings = [];
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#{2,3}\s+(.+)/);
    if (match) {
      const level = line.startsWith('###') ? 3 : 2;
      const text = match[1].trim();
      headings.push({ level, text, slug: text });
    }
  }
  return headings;
}

function extractSearchText(body) {
  let text = body;
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^```\w*\s*$/gm, '');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function* walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      yield* walkDir(fullPath);
    } else if (extname(entry) === '.md') {
      yield fullPath;
    }
  }
}

// --- Validation ---

function validateDoc(meta, filePath, seenIds, warnings) {
  const errs = [];

  for (const field of REQUIRED_FIELDS) {
    const v = meta[field];
    if (v === undefined || v === null || v === '') {
      errs.push(`Missing required field: ${field}`);
    }
  }

  if (errs.length > 0) {
    throw new Error(`${filePath}:\n${errs.map(e => `  - ${e}`).join('\n')}`);
  }

  if (!ID_PATTERN.test(meta.id)) {
    errs.push(`Invalid id "${meta.id}": must only contain lowercase letters, numbers, and hyphens`);
  }
  if (seenIds.has(meta.id)) {
    errs.push(`Duplicate id "${meta.id}" (previously seen in another file)`);
  }
  seenIds.add(meta.id);

  if (!VALID_LANGS.has(meta.lang)) {
    errs.push(`Invalid lang "${meta.lang}": must be "zh" or "en"`);
  }

  if (typeof meta.order !== 'number' || !Number.isFinite(meta.order)) {
    errs.push(`Invalid order "${meta.order}": must be a number`);
  }

  if (!meta.tags) {
    warnings.push(`${filePath}: Missing "tags" field (recommended)`);
  }

  if (errs.length > 0) {
    throw new Error(`${filePath}:\n${errs.map(e => `  - ${e}`).join('\n')}`);
  }
}

// --- Link & Image Extraction ---

function stripCodeBlocks(body) {
  return body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '');
}

function extractLinksAndImages(body) {
  const stripped = stripCodeBlocks(body);
  const links = [];
  const images = [];

  const imageRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  let match;
  while ((match = imageRe.exec(stripped)) !== null) {
    images.push({ alt: match[1], url: match[2] });
  }

  const linkRe = /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g;
  while ((match = linkRe.exec(stripped)) !== null) {
    links.push({ text: match[1], url: match[2] });
  }

  return { links, images };
}

// --- Link & Image Validation (--strict) ---

function isDangerousUrl(url) {
  const lower = url.toLowerCase().trim();
  if (lower.startsWith('javascript:')) return true;
  if (lower.startsWith('data:text/html')) return true;
  return false;
}

function validateLinks(docRelPath, links, images) {
  const errs = [];
  const docDir = dirname(join(ROOT, docRelPath));

  for (const link of links) {
    const url = link.url;

    if (/^https?:\/\//i.test(url)) continue;
    if (/^mailto:/i.test(url)) continue;
    if (url.startsWith('#')) continue;
    if (/^#\//.test(url)) continue;

    if (isDangerousUrl(url)) {
      errs.push(
        `Dangerous link:\n  Source: ${docRelPath}\n  Link: ${url}`
      );
      continue;
    }

    const resolved = join(docDir, url).replace(/\\/g, '/');
    if (!existsSync(resolved)) {
      errs.push(
        `Broken Markdown link:\n  Source: ${docRelPath}\n  Link: ${url}\n  Resolved: ${relative(ROOT, resolved).replace(/\\/g, '/')}`
      );
    }
  }

  for (const img of images) {
    const url = img.url;

    if (/^https?:\/\//i.test(url)) continue;
    if (url.startsWith('data:image/')) continue;

    if (isDangerousUrl(url)) {
      errs.push(
        `Dangerous image link:\n  Source: ${docRelPath}\n  Image: ${url}`
      );
      continue;
    }

    const resolved = join(docDir, url).replace(/\\/g, '/');
    if (!existsSync(resolved)) {
      errs.push(
        `Broken image link:\n  Source: ${docRelPath}\n  Image: ${url}\n  Resolved: ${relative(ROOT, resolved).replace(/\\/g, '/')}`
      );
    }
  }

  return errs;
}

// --- Strict Content Quality Checks ---

function strictContentChecks(meta, body, docRelPath) {
  const w = [];

  if (meta.summary && typeof meta.summary === 'string' && meta.summary.length < 10) {
    w.push(`${docRelPath}: Summary is very short (${meta.summary.length} chars, recommended >= 10)`);
  }

  if (meta.title && typeof meta.title === 'string' && meta.title.length > 80) {
    w.push(`${docRelPath}: Title is very long (${meta.title.length} chars, recommended <= 80)`);
  }

  const bodyText = body.trim();
  if (bodyText.length < 50) {
    w.push(`${docRelPath}: Body is very short (${bodyText.length} chars, recommended >= 50)`);
  }

  const headings = extractHeadings(body);
  if (headings.length === 0) {
    w.push(`${docRelPath}: No h2/h3 headings found (recommended for TOC generation)`);
  }

  return w;
}

// --- Dist Freshness Check (--check) ---

function stripGeneratedAt(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    delete obj.generatedAt;
    return JSON.stringify(obj);
  } catch {
    return jsonStr;
  }
}

function checkDistFreshness(generated) {
  const stale = [];
  const missing = [];

  const allFiles = [
    'docs.json',
    'search.json',
    'site.json',
    ...DATA_FILES,
  ];

  for (const filename of allFiles) {
    const distPath = join(DIST_DIR, filename);
    if (!existsSync(distPath)) {
      missing.push(`dist/${filename}`);
      continue;
    }

    const existingRaw = readFileSync(distPath, 'utf-8');
    const newRaw = generated[filename];

    if (stripGeneratedAt(existingRaw) !== stripGeneratedAt(newRaw)) {
      stale.push(`dist/${filename}`);
    }
  }

  return { stale, missing };
}

// --- Generate dist content as strings ---

function generateDistContent(docsOutput, searchOutput, siteData, dataFiles) {
  const result = {};
  result['docs.json'] = JSON.stringify(docsOutput, null, 2);
  result['search.json'] = JSON.stringify(searchOutput, null, 2);
  result['site.json'] = JSON.stringify(siteData, null, 2);
  for (const [filename, data] of Object.entries(dataFiles)) {
    result[filename] = JSON.stringify(data, null, 2);
  }
  return result;
}

// --- Main Build ---

function build() {
  const warnings = [];
  const errors = [];
  let linkErrors = 0;
  let imageErrors = 0;
  let dangerousErrors = 0;

  if (!existsSync(DOCS_DIR)) {
    console.error('docs/ directory not found');
    process.exit(1);
  }

  // 1. Scan all markdown files
  const mdFiles = [...walkDir(DOCS_DIR)].sort();

  const docs = [];
  const seenIds = new Set();

  for (const filePath of mdFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const { meta, body } = parseFrontmatter(content, filePath);
      validateDoc(meta, filePath, seenIds, warnings);

      const relPath = relative(ROOT, filePath).replace(/\\/g, '/');
      const headings = extractHeadings(body);
      const searchText = extractSearchText(body);
      const wordCount = countWords(body);
      const readingTime = Math.max(1, Math.round(wordCount / 200));

      docs.push({
        id: meta.id,
        title: meta.title,
        lang: meta.lang,
        category: meta.category,
        tags: meta.tags || [],
        summary: meta.summary,
        order: meta.order,
        path: relPath,
        route: `#/doc/${meta.id}`,
        headings,
        wordCount,
        readingTime,
        _searchText: searchText,
      });
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (errors.length > 0) {
    console.error('\nBuild failed with errors:\n');
    for (const err of errors) {
      console.error(`  ${err}`);
    }
    console.error('');
    process.exit(1);
  }

  // 2. Strict mode: link & image checks
  const strictWarnings = [];

  if (STRICT_MODE) {
    for (const doc of docs) {
      try {
        const content = readFileSync(join(ROOT, doc.path), 'utf-8');
        const { body } = parseFrontmatter(content, doc.path);
        const { links, images } = extractLinksAndImages(body);

        const linkErrs = validateLinks(doc.path, links, images);
        for (const e of linkErrs) {
          if (e.startsWith('Broken Markdown link')) linkErrors++;
          else if (e.startsWith('Broken image link')) imageErrors++;
          else if (e.startsWith('Dangerous')) dangerousErrors++;
          errors.push(e);
        }

        const contentWarnings = strictContentChecks(doc, body, doc.path);
        strictWarnings.push(...contentWarnings);
      } catch (e) {
        errors.push(e.message);
      }
    }
  }

  // 3. Check for serious errors (fail immediately)
  const seriousErrors = errors.filter(e =>
    !e.startsWith('Dangerous') && !e.includes('Dangerous') &&
    e.startsWith('Broken')
  );
  const allDangerous = errors.filter(e => e.startsWith('Dangerous') || e.includes('Dangerous'));

  if (STRICT_MODE && (linkErrors > 0 || imageErrors > 0 || dangerousErrors > 0)) {
    console.error('\nBuild failed with strict errors:\n');
    for (const err of errors) {
      console.error(`  ${err}`);
    }
    console.error('');
    process.exit(1);
  }

  // 4. Sort docs: lang, category, order, title
  docs.sort((a, b) => {
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  // 5. Compute stats
  const byLang = {};
  const byCategory = {};
  for (const doc of docs) {
    byLang[doc.lang] = (byLang[doc.lang] || 0) + 1;
    byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
  }

  // 6. Generate docs.json (strip _searchText)
  const now = new Date().toISOString();
  const docsOutput = {
    version: 1,
    generatedAt: now,
    stats: {
      total: docs.length,
      byLang,
      byCategory,
    },
    docs: docs.map(({ _searchText, ...rest }) => rest),
  };

  // 7. Generate search.json
  const searchOutput = {
    version: 1,
    generatedAt: now,
    items: docs.map(doc => ({
      id: doc.id,
      title: doc.title,
      lang: doc.lang,
      category: doc.category,
      tags: doc.tags,
      summary: doc.summary,
      path: doc.path,
      route: doc.route,
      headings: doc.headings.map(h => h.text),
      text: doc._searchText,
    })),
  };

  // 8. Load site.json
  let siteData;
  try {
    const siteRaw = readFileSync(SITE_JSON_PATH, 'utf-8');
    siteData = JSON.parse(siteRaw);
  } catch (e) {
    console.error(`Failed to parse site.json: ${e.message}`);
    process.exit(1);
  }

  // 9. Load & validate data files
  const dataFiles = {};
  for (const filename of DATA_FILES) {
    const filePath = join(DATA_DIR, filename);
    if (!existsSync(filePath)) {
      console.error(`Data file not found: data/${filename}`);
      process.exit(1);
    }
    try {
      const raw = readFileSync(filePath, 'utf-8');
      dataFiles[filename] = JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to parse data/${filename}: ${e.message}`);
      process.exit(1);
    }
  }

  // 10. Validate featuredDocs references
  const docIds = new Set(docs.map(d => d.id));

  for (const lang of ['zh', 'en']) {
    const homeKey = `home.${lang}.json`;
    const homeData = dataFiles[homeKey];
    if (homeData && Array.isArray(homeData.featuredDocs)) {
      for (const feature of homeData.featuredDocs) {
        if (!docIds.has(feature.id)) {
          console.error(
            `data/${homeKey}: featuredDocs references unknown doc id "${feature.id}"`
          );
          process.exit(1);
        }
      }
    }
  }

  // 11. Lightweight validation of resource JSONs
  const RESOURCE_FILES = ['resources.json', 'papers.json', 'projects.json', 'tutorials.json'];
  for (const filename of RESOURCE_FILES) {
    const data = dataFiles[filename];
    const items = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      if (!item.title) {
        warnings.push(
          `data/${filename}: item "${item.id || '(no id)'}" missing recommended "title" field`
        );
      }
    }
  }

  // 11b. Resource contract checks
  const resourceErrors = [];
  const allowedResourceTracks = new Set(['math', 'physics', 'electronics', 'programming', 'signals-control']);
  const resources = dataFiles['resources.json'] && Array.isArray(dataFiles['resources.json'].items)
    ? dataFiles['resources.json'].items
    : [];
  const seenResourceIds = new Set();

  for (const item of resources) {
    const label = item.id || item.title || '(unknown resource)';
    const required = [
      'id',
      'title',
      'url',
      'type',
      'lang',
      'level',
      'audience_level',
      'track',
      'category',
      'scope',
      'foundation_module',
      'summary',
      'best_for',
      'related_terms',
      'tags',
      'priority',
      'verified_date',
    ];

    for (const field of required) {
      if (item[field] === undefined || item[field] === null || item[field] === '') {
        resourceErrors.push(`data/resources.json: item "${label}" missing required field "${field}"`);
      }
    }

    if (item.id) {
      if (!ID_PATTERN.test(item.id)) {
        resourceErrors.push(`data/resources.json: item "${label}" has invalid id`);
      }
      if (seenResourceIds.has(item.id)) {
        resourceErrors.push(`data/resources.json: duplicate resource id "${item.id}"`);
      }
      seenResourceIds.add(item.id);
    }

    if (item.scope !== 'engineering-terms') {
      resourceErrors.push(`data/resources.json: item "${label}" must use scope "engineering-terms"`);
    }
    if (!allowedResourceTracks.has(item.track)) {
      resourceErrors.push(`data/resources.json: item "${label}" has invalid track "${item.track}"`);
    }
    if (item.category !== item.track) {
      resourceErrors.push(`data/resources.json: item "${label}" category should match track`);
    }
    if (!Array.isArray(item.related_terms) || item.related_terms.length === 0) {
      resourceErrors.push(`data/resources.json: item "${label}" must include at least one related_terms value`);
    }
    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      resourceErrors.push(`data/resources.json: item "${label}" must include at least one tag`);
    }
    if (typeof item.priority !== 'number' || !Number.isFinite(item.priority)) {
      resourceErrors.push(`data/resources.json: item "${label}" priority must be a number`);
    }
    if (typeof item.url === 'string' && /youtube\.com\/(c|playlist)|playlist\?list=/i.test(item.url)) {
      resourceErrors.push(`data/resources.json: item "${label}" must not use a YouTube channel or playlist URL`);
    }
  }

  if (resourceErrors.length > 0) {
    console.error('\nBuild failed with resource errors:\n');
    for (const err of resourceErrors) {
      console.error(`  ${err}`);
    }
    console.error('');
    process.exit(1);
  }

  // 12. Build category order map from site.json
  const categoryOrder = {};
  if (siteData.categories) {
    for (const cat of siteData.categories) {
      categoryOrder[cat.id] = cat.order;
    }
  }

  const sortedCategories = Object.keys(byCategory).sort((a, b) => {
    const oA = categoryOrder[a] ?? 999;
    const oB = categoryOrder[b] ?? 999;
    if (oA !== oB) return oA - oB;
    return a.localeCompare(b);
  });

  // 13. Generate dist content as strings (for comparison in --check mode)
  const generatedContent = generateDistContent(docsOutput, searchOutput, siteData, dataFiles);

  // 14. --check mode: compare with existing dist
  let distUpToDate = true;
  let distStaleFiles = [];
  let distMissingFiles = [];

  if (CHECK_MODE) {
    if (!existsSync(DIST_DIR)) {
      distUpToDate = false;
      for (const f of ['docs.json', 'search.json', 'site.json', ...DATA_FILES]) {
        distMissingFiles.push(`dist/${f}`);
      }
    } else {
      const { stale, missing } = checkDistFreshness(generatedContent);
      distStaleFiles = stale;
      distMissingFiles = missing;
      distUpToDate = stale.length === 0 && missing.length === 0;
    }
  }

  // 15. Merge strict warnings into warnings
  if (STRICT_MODE) {
    warnings.push(...strictWarnings);
  }

  // 16. Write dist files (skip in --check mode)
  if (!CHECK_MODE) {
    if (!existsSync(DIST_DIR)) {
      mkdirSync(DIST_DIR, { recursive: true });
    }

    writeFileSync(join(DIST_DIR, 'docs.json'), generatedContent['docs.json'], 'utf-8');
    writeFileSync(join(DIST_DIR, 'search.json'), generatedContent['search.json'], 'utf-8');
    writeFileSync(join(DIST_DIR, 'site.json'), generatedContent['site.json'], 'utf-8');

    for (const [filename, data] of Object.entries(dataFiles)) {
      writeFileSync(join(DIST_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
    }
  }

  // 17. Print output
  const generatedFiles = [
    'dist/docs.json',
    'dist/search.json',
    'dist/site.json',
    ...DATA_FILES.map(f => `dist/${f}`),
  ];

  if (CHECK_MODE && STRICT_MODE) {
    // --check --strict output
    console.log('\n术语地图 content validation passed.\n');
    console.log('Documents:');
    console.log(`- Total: ${docs.length}`);
    console.log('');
    console.log('Dist:');
    if (distUpToDate) {
      console.log('- Up to date: yes');
    } else {
      console.log('- Up to date: no');
      if (distMissingFiles.length > 0) {
        console.log('- Missing:');
        for (const f of distMissingFiles) {
          console.log(`  - ${f}`);
        }
      }
      if (distStaleFiles.length > 0) {
        console.log('- Stale:');
        for (const f of distStaleFiles) {
          console.log(`  - ${f}`);
        }
      }
    }
    console.log('');
    console.log('Strict checks:');
    console.log(`- Broken links: ${linkErrors}`);
    console.log(`- Broken images: ${imageErrors}`);
    console.log(`- Dangerous links: ${dangerousErrors}`);
    console.log('');
    console.log('Warnings:');
    if (warnings.length === 0) {
      console.log('- None');
    } else {
      for (const w of warnings) {
        console.log(`- ${w}`);
      }
    }
    console.log('');
  } else if (CHECK_MODE) {
    // --check only output
    if (!distUpToDate) {
      console.log('');
      console.log('Dist files are stale:\n');
      if (distMissingFiles.length > 0) {
        console.log('Missing:');
        for (const f of distMissingFiles) {
          console.log(`- ${f}`);
        }
        console.log('');
      }
      if (distStaleFiles.length > 0) {
        console.log('Stale:');
        for (const f of distStaleFiles) {
          console.log(`- ${f}`);
        }
        console.log('');
      }
      console.log('Run:');
      console.log('  node scripts/build-index.mjs');
      console.log('');
      process.exit(1);
    }
    console.log('\nDist is up to date.\n');
  } else {
    // Default mode (and --strict only mode)
    console.log('\n术语地图 content index built successfully.\n');
    console.log('Documents:');
    console.log(`- Total: ${docs.length}`);
    for (const lang of ['zh', 'en']) {
      console.log(`- ${lang}: ${byLang[lang] || 0}`);
    }
    console.log('');
    console.log('Categories:');
    for (const cat of sortedCategories) {
      console.log(`- ${cat}: ${byCategory[cat]}`);
    }
    console.log('');
    if (STRICT_MODE) {
      console.log('Validation:');
      console.log('- Strict mode: on');
      console.log(`- Broken links: ${linkErrors}`);
      console.log(`- Broken images: ${imageErrors}`);
      console.log(`- Dangerous links: ${dangerousErrors}`);
      console.log('');
    }
    console.log('Generated:');
    for (const f of generatedFiles) {
      console.log(`- ${f}`);
    }
    console.log('');
    console.log('Warnings:');
    if (warnings.length === 0) {
      console.log('- None');
    } else {
      for (const w of warnings) {
        console.log(`- ${w}`);
      }
    }
    console.log('');
  }

  // 18. Exit with failure if dist is stale in --check mode
  if (CHECK_MODE && !distUpToDate) {
    process.exit(1);
  }
}

build();
