/*
 * 术语地图 — Global Configuration
 * ============================================================================
 * 集中管理所有可配置常量。修改此文件即可更改站点行为。
 */
const CONFIG = {
  /* Site identity */
  siteName: "术语地图",
  siteNameFull:
    "术语地图",
  tagline: {
    zh: "工程术语与资源索引",
    en: "Engineering Terms and Resources",
  },

  /* Language */
  defaultLang: "zh",
  supportedLangs: ["zh", "en"],

  /* ------------------------------------------------------------------------
   * Environment detection — auto-switch between local and remote
   *
   * Local:  localhost, 127.0.0.1, or file:// protocol
   * Remote: GitHub Pages (production)
   * ------------------------------------------------------------------------ */
  isLocal:
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:",

  /* Content data root. Local and monorepo Pages deployments use sibling dirs. */
  contentBaseLocal: "/ema-wiki-content",
  contentBaseRemote: "../ema-wiki-content",

  /* Automatically set based on environment */
  get contentBase() {
    return this.isLocal ? this.contentBaseLocal : this.contentBaseRemote;
  },

  /* Repository URLs are optional; leave empty until a public repo exists. */
  contentRepoUrl: "",
  siteRepoUrl: "",

  /* Data endpoints — 相对于 contentBase */
  endpoints: {
    docs: "/dist/docs.json",
    site: "/dist/site.json",
    search: "/dist/search.json",
    resources: "/dist/resources.json",
    papers: "/dist/papers.json",
    projects: "/dist/projects.json",
    tutorials: "/dist/tutorials.json",
    home: function (lang) { return "/dist/home." + lang + ".json"; },
  },

  /* Build info */
  version: "0.8.0",
  round: "Engineering Terms and Resources",
};
