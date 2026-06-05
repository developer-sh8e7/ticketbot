(function () {
  "use strict";

  var BRAINROTS = [];
  var BRAINROT_TYPES_CATALOG = null;
  var BRAINROT_ICON_SHEETS = null;
  var TYPE_MULTS_PAYLOAD = null;
  var REBIRTHS_PAYLOAD = null;
  var LUCKY_ROTS_PAYLOAD = null;
  var TRAITS_PAYLOAD = null;
  var LLAMA_ROTS_PAYLOAD = null;
  var RARITY_SPAWN_ENGINE_PAYLOAD = null;
  var BRAINROT_SPAWN_TYPE_PAYLOAD = null;
  var TYPE_SPAWN_EVENT_TABLES = null;
  var ETERNAL_MACHINE_RATES = null;
  var ETERNAL_MACHINE_REFERENCE = null;
  var CATALOG_META = null;
  var BRAINROT_RATINGS = {};
  var BRAINROTS_CATALOG_SCROLL_RESTORE_Y = null;

  var BRAINROT_REACTION_DEFS = [
    { id: "fire", icon: "flame", label: "Fire" },
    { id: "love", icon: "heart", label: "Love" },
    { id: "flush", icon: "alert", label: "Flushed" },
    { id: "vomit", icon: "cloud", label: "Vomit" },
    { id: "poop", icon: "trash", label: "Poop" },
  ];
  var GADGETS_PAYLOAD = null;
  var ADMIN_MACHINE_REF = null;
  var ADMIN_MACHINE_ICONS_PAYLOAD = null;
  var ADMIN_MACHINE_API_MODE = false;
  var ADMIN_MACHINE_PREVIEW = null;
  var ADMIN_MACHINE_SERVER_OFFSET_SEC = 0;
  var ADMIN_MACHINE_PREVIEW_BOUNDARY_UNIX = 0;
  var ADMIN_MACHINE_COUNTDOWN_LABEL = "Next rotation starts in";
  var adminMachineRefetchInFlight = false;
  var adminMachineTimerStarted = false;
  var adminMachinePreviewKey = "";
  var adminMachineLiveFromBoot = false;
  var brainrotRatingsFromBoot = false;
  var brainrotRatingsFetchPromise = null;
  var loadFailed = false;
  var catalogReady = false;
  var lazyCatalogBoot = false;
  var lazyFullCatalogPromise = null;
  var lazyBoxrotsPromise = null;
  var lazyWheelPromise = null;
  var lazyShopPromise = null;
  var brainrotFiltersWired = false;
  var rebirthGadgetsReady = false;
  var luckyDataReady = false;
  var traitsDataReady = false;
  var llamaDataReady = false;
  var codesDataReady = false;
  var blogPageHandlersBound = false;
  var blogLoading = false;
  var blogLoadedAt = 0;
  var BLOG_ITEMS = [];
  var BLOG_ERROR = "";
  var blogDetailLoading = false;
  var BLOG_DETAIL = null;
  var BLOG_DETAIL_ERROR = "";
  var boxRotsDataReady = false;
  var SITE_ALERTS_PAYLOAD = null;
  var SITE_ALERTS_STORAGE_KEY = "stbarab_site_alerts_dismissed";
  var CODES_PAYLOAD = null;
  var REALTIME_EVENTS_SCHEDULE = null;
  var BOX_ROTS_PAYLOAD = null;
  var WHEEL_PAYLOAD = null;
  var SHOP_PAYLOAD = null;
  var shopDataReady = false;
  var wheelDataReady = false;
  var codesPanelMode = "active";
  var codesPageHandlersBound = false;
  var MAP_PAGE_PAYLOAD = null;
  function isMapEditMode() {
    function truthyMapEdit(val) {
      return val === "1" || val === "true" || val === "yes";
    }
    try {
      var q = new URLSearchParams(location.search).get("mapEdit");
      if (truthyMapEdit(q)) return true;
      if (USE_HASH) {
        var h = location.hash.replace(/^#/, "");
        var qi = h.indexOf("?");
        if (qi >= 0) {
          q = new URLSearchParams(h.slice(qi + 1)).get("mapEdit");
          if (truthyMapEdit(q)) return true;
        }
      }
    } catch (e) {}
    return location.hash === "#map-edit";
  }

  function mapHasWorldBounds(p) {
    if (!p) return false;
    var minX = p.minX;
    var maxX = p.maxX;
    var minY = p.minY;
    var maxY = p.maxY;
    return (
      typeof minX === "number" &&
      typeof maxX === "number" &&
      typeof minY === "number" &&
      typeof maxY === "number" &&
      maxX > minX &&
      maxY > minY
    );
  }

  function mapWorldToPercent(p, wx, wy) {
    if (!mapHasWorldBounds(p)) {
      return { px: wx, py: wy, ok: false };
    }
    var minX = p.minX;
    var maxX = p.maxX;
    var minY = p.minY;
    var maxY = p.maxY;
    return {
      px: ((wx - minX) / (maxX - minX)) * 100,
      py: ((wy - minY) / (maxY - minY)) * 100,
      ok: true,
    };
  }

  function mapImageContainMetrics(frame, img) {
    if (!frame) return { ok: false };
    var Wf = frame.clientWidth;
    var Hf = frame.clientHeight;
    if (!(Wf > 0 && Hf > 0)) return { ok: false };
    var Wn = img && img.naturalWidth > 0 ? img.naturalWidth : 0;
    var Hn = img && img.naturalHeight > 0 ? img.naturalHeight : 0;
    if (!(Wn > 0 && Hn > 0)) {
      return { ok: true, Wf: Wf, Hf: Hf, ox: 0, oy: 0, Wd: Wf, Hd: Hf };
    }
    var s = Math.min(Wf / Wn, Hf / Hn);
    var Wd = Wn * s;
    var Hd = Hn * s;
    var ox = (Wf - Wd) / 2;
    var oy = (Hf - Hd) / 2;
    return { ok: true, Wf: Wf, Hf: Hf, ox: ox, oy: oy, Wd: Wd, Hd: Hd };
  }

  function mapFramePercentToLogicalPercent(pfx, pyf, m) {
    if (!m || !m.ok) return { px: pfx, py: pyf };
    if (!(m.Wd > 0 && m.Hd > 0)) return { px: pfx, py: pyf };
    var fx = (pfx / 100) * m.Wf;
    var fy = (pyf / 100) * m.Hf;
    var ux = ((fx - m.ox) / m.Wd) * 100;
    var uy = ((fy - m.oy) / m.Hd) * 100;
    ux = Math.max(0, Math.min(100, ux));
    uy = Math.max(0, Math.min(100, uy));
    return { px: ux, py: uy };
  }

  function mapLogicalPercentToFramePercent(px, py, m) {
    if (!m || !m.ok) return { lx: px, ly: py };
    if (!(m.Wd > 0 && m.Hd > 0)) return { lx: px, ly: py };
    var fx = m.ox + (px / 100) * m.Wd;
    var fy = m.oy + (py / 100) * m.Hd;
    return { lx: (fx / m.Wf) * 100, ly: (fy / m.Hf) * 100 };
  }

  function layoutMapMarkersForImageContain(scopeRoot) {
    var root = scopeRoot && scopeRoot.querySelector ? scopeRoot : document;
    var frame = root.querySelector(".map-surface__frame");
    var img = frame && frame.querySelector(".map-surface__img");
    var markers = root.querySelector("#map-markers");
    if (!frame || !markers) return;
    var m = mapImageContainMetrics(frame, img);
    $all(".map-marker", markers).forEach(function (el) {
      var px = parseFloat(el.getAttribute("data-map-pct-x"));
      var py = parseFloat(el.getAttribute("data-map-pct-y"));
      if (px !== px || py !== py) return;
      var d = mapLogicalPercentToFramePercent(px, py, m);
      el.style.left = d.lx + "%";
      el.style.top = d.ly + "%";
    });
  }

  /** Pixel position within markers box (0–100) to stored coordinates (world if bounds else percent). */
  function percentXYToStorage(p, pxPct, pyPct) {
    if (mapHasWorldBounds(p)) {
      return {
        x: p.minX + (pxPct / 100) * (p.maxX - p.minX),
        y: p.minY + (pyPct / 100) * (p.maxY - p.minY),
      };
    }
    return { x: pxPct, y: pyPct };
  }
  var BASE_TITLE = "STB-Arab - Steal the Brainrot";

  var USE_HASH = location.protocol === "file:";

  /**
   * Path prefix when the app is hosted under a subpath (matches &lt;base href&gt;).
   * Without this, fetch("/data/...") and pathname routing miss /project/data and /project/rebirth.
   */
  function getAppPathPrefix() {
    var b = document.querySelector("base");
    if (!b) return "";
    var href = b.getAttribute("href");
    if (!href) return "";
    try {
      var u = new URL(href, location.href);
      var p = u.pathname.replace(/\/$/, "");
      if (!p || p === "/") return "";
      return p;
    } catch (e) {
      return "";
    }
  }

  /** Root-absolute JSON paths for http(s); relative for file:// so deep links like /brainrots/x still fetch /data/... */
  function dataJsonUrl(rel) {
    if (USE_HASH) {
      return rel;
    }
    var path = String(rel).replace(/^\/+/, "");
    var prefix = getAppPathPrefix();
    if (prefix) {
      return prefix + "/" + path;
    }
    return "/" + path;
  }

  /** Root-absolute asset URL (images) when the app is hosted under a subpath. */
  function assetUrlPath(rel) {
    var path = String(rel || "").replace(/^\/+/, "");
    var prefix = getAppPathPrefix();
    if (prefix) return prefix + "/" + path;
    return "/" + path;
  }

  /** Use for <img src> / inline URLs so images load when the site is under a path prefix. */
  function publicAssetSrc(url) {
    if (url == null || url === "") return "";
    var s = String(url);
    if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;
    return assetUrlPath(s.replace(/^\/+/, ""));
  }

  function soundPublicUrlFromJson(jsonPath) {
    return publicAssetSrc(String(jsonPath == null ? "" : jsonPath).trim());
  }

  function soundWavPublicUrlFromJson(jsonPath) {
    var u = soundPublicUrlFromJson(jsonPath);
    if (/\.m4a$/i.test(u)) return u.replace(/\.m4a$/i, ".wav");
    return u;
  }

  function soundM4aPublicUrlFromJson(jsonPath) {
    var u = soundPublicUrlFromJson(jsonPath);
    if (/\.wav$/i.test(u)) return u.replace(/\.wav$/i, ".m4a");
    return u;
  }

  /** URL for CSS `url(...)` inside a double-quoted HTML `style=""`. JSON.stringify would inject `"` and break the attribute. */
  function cssUrlForInlineStyle(u) {
    return "'" + String(u == null ? "" : u).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }

  var RARITY_ORDER = [
    "Common",
    "Rare",
    "Epic",
    "Legendary",
    "Mythic",
    "Brainrot God",
    "Secret",
    "Eternal",
    "Goat",
    "LuckyRot",
    "Admin",
  ];

  /** Base URL for PNG/WebP; default filenames only — optional `icon` on item / type overrides. */
  var BRAINROT_ICON_BASE = "/assets/images/brainrots";

  /**
   * Map sheet filename stem → folder under types/ (matches assets layout: halloween/Halloween2.png).
   * Used when JSON has sheet "Halloween2" but not sheetFolder — avoids wrong path types/default/Halloween2.png.
   */
  function inferTypeFolderFromSheetStem(stem) {
    if (!stem || String(stem).indexOf("/") >= 0) return null;
    stem = String(stem);
    var exact = {
      FireIce: "ice-fire",
      FireIce2: "ice-fire",
      FireIce3: "ice-fire",
      Love: "lovely",
      Love2: "lovely",
      Love3: "lovely",
      Specials: "Specials",
    };
    if (exact[stem]) return exact[stem];
    var m = /^([A-Za-z]+)(\d*)$/.exec(stem);
    if (!m) return null;
    return m[1].toLowerCase();
  }

  var RARITY_CLASS = {
    Common: "rarity-common",
    Rare: "rarity-rare",
    Epic: "rarity-epic",
    Legendary: "rarity-legendary",
    Mythic: "rarity-mythic",
    "Brainrot God": "rarity-brainrot-god",
    /** JSON catalog uses no space; same badge as "Brainrot God" (rainbow). */
    BrainrotGod: "rarity-brainrot-god",
    Secret: "rarity-secret",
    Eternal: "rarity-eternal",
    Admin: "rarity-admin",
    Goat: "rarity-goat",
    LuckyRot: "rarity-luckyrot",
  };

  /** Display string for badge / filters (canonical spacing). */
  function formatRarityLabel(rarity) {
    if (rarity === "BrainrotGod") return "Brainrot God";
    if (rarity === "LuckyRot") return "Lucky Rots";
    return String(rarity == null ? "" : rarity);
  }

  function titleCaseWords(s) {
    var t = String(s == null ? "" : s).trim();
    if (!t) return t;
    return t
      .split(/\s+/)
      .map(function (w) {
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  /**
   * JSON uses `BrainrotGod` but RARITY_ORDER / UI use `Brainrot God`. Bucket keys must match
   * RARITY_ORDER or sections render in the wrong place (Brainrot God appended after Admin).
   */
  function canonicalRarityBucketKey(rarity) {
    if (rarity == null || rarity === "") return "";
    if (rarity === "BrainrotGod") return "Brainrot God";
    var s = String(rarity).trim();
    if (s === "BrainrotGod") return "Brainrot God";
    var i;
    for (i = 0; i < RARITY_ORDER.length; i++) {
      var key = RARITY_ORDER[i];
      if (key.toLowerCase() === s.toLowerCase()) return key;
    }
    var compact = s.replace(/\s+/g, "");
    if (compact.toLowerCase() === "brainrotgod") return "Brainrot God";
    return rarity;
  }

  function rarityOrderIndex(rarity) {
    var r = canonicalRarityBucketKey(rarity);
    var i = RARITY_ORDER.indexOf(r);
    return i === -1 ? 999 : i;
  }

  function rarityBadgeClass(rarity) {
    if (rarity != null && RARITY_CLASS[rarity]) return RARITY_CLASS[rarity];
    var c = canonicalRarityBucketKey(rarity);
    if (c && RARITY_CLASS[c]) return RARITY_CLASS[c];
    return "rarity-common";
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  /** For HTML attribute values (e.g. title="", alt=""). */
  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function stbIconSvg(name, className) {
    var cls = className || "stb-icon";
    var paths = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
      map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
      catalog: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/><path d="M8 3v18"/>',
      rates: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-7"/>',
      wheel: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M4 12h16"/><path d="m6.3 6.3 11.4 11.4"/><path d="m17.7 6.3-11.4 11.4"/>',
      rebirth: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v8h-8"/>',
      events: '<path d="M7 2v4"/><path d="M17 2v4"/><path d="M3 9h18"/><path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
      machine: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 6V4h8v2"/><path d="M8 12h8"/><path d="M9 16h.01"/><path d="M15 16h.01"/>',
      eternal: '<path d="M18 8a6 6 0 0 0-11.3-2.8L5 8"/><path d="M6 16a6 6 0 0 0 11.3 2.8L19 16"/><path d="M5 4v4h4"/><path d="M19 20v-4h-4"/>',
      shop: '<path d="M6 2h12l1 6H5l1-6z"/><path d="M5 8h14v12H5z"/><path d="M9 12h6"/>',
      stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
      collection: '<path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5z"/><path d="M8 7h6"/><path d="M8 11h6"/>',
      blog: '<path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
      codes: '<path d="M8 7a2.5 2.5 0 1 1 4 2H8V7z"/><path d="M16 7a2.5 2.5 0 1 0-4 2h4V7z"/><path d="M4 11h16"/><path d="M5 11v9h14v-9"/><path d="M12 9v11"/>',
      external: '<path d="M14 3h7v7"/><path d="M21 3 10 14"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      flame: '<path d="M12 22c4 0 7-2.8 7-6.7 0-2.4-1.2-4.4-3-6.2-.7 2.1-2 3.1-3.5 3.5.8-3.5-.8-6.1-3.1-8.6C9.1 7.7 5 9.9 5 15.3 5 19.2 8 22 12 22z"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
      alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01"/>',
      cloud: '<path d="M17.5 19H8a5 5 0 1 1 .9-9.9A6 6 0 0 1 20 12.5 3.5 3.5 0 0 1 17.5 19z"/><path d="M9 14h6"/><path d="M10 17h4"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    };
    return (
      '<svg class="' +
      escapeAttr(cls) +
      '" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (paths[name] || paths.home) +
      "</svg>"
    );
  }

  function enhanceNavIcons() {
    var iconByNav = {
      home: "home",
      map: "map",
      brainrots: "catalog",
      "spawn-rates": "rates",
      wheel: "wheel",
      rebirth: "rebirth",
      events: "events",
      "admin-machine": "machine",
      "eternal-machine": "eternal",
      shop: "shop",
      stats: "stats",
      collection: "collection",
      blog: "blog",
      codes: "codes",
    };
    $all(".nav-tab[data-nav]").forEach(function (el) {
      if (el.querySelector(".nav-tab__icon")) return;
      var key = el.getAttribute("data-nav") || "";
      var icon = iconByNav[key];
      if (!icon) return;
      el.insertAdjacentHTML("afterbegin", stbIconSvg(icon, "nav-tab__icon"));
    });
  }

  function renderHomeQuickGrid() {
    var root = document.getElementById("wiki-home-quick-grid");
    if (!root || root.getAttribute("data-ready") === "1") return;
    var links = [
      { path: "/map", icon: "map", label: "Map" },
      { path: "/brainrots", icon: "catalog", label: "Brainrots" },
      { path: "/events", icon: "events", label: "Events" },
      { path: "/admin-machine", icon: "machine", label: "Admin Machine" },
      { path: "/eternal-machine", icon: "eternal", label: "Eternal Machine" },
      { path: "/codes", icon: "codes", label: "Codes" },
      { path: "/collection", icon: "collection", label: "Collection" },
      { path: "/rebirth", icon: "rebirth", label: "Rebirth" },
    ];
    root.innerHTML = links
      .map(function (item) {
        return (
          '<a class="wiki-home__quick-link" data-spa-path="' +
          escapeAttr(item.path) +
          '" href="' +
          escapeAttr(spaHref(item.path)) +
          '">' +
          stbIconSvg(item.icon, "wiki-home__quick-icon") +
          '<span class="wiki-home__quick-label">' +
          escapeHtml(item.label) +
          "</span></a>"
        );
      })
      .join("");
    root.setAttribute("data-ready", "1");
  }

  var STBARAB_LANG_STORAGE_KEY = "stbarab_lang";
  var STBARAB_I18N_TREE = null;
  var STBARAB_I18N_MANIFEST = null;
  var STBARAB_I18N_FALLBACK_MANIFEST = {
    languages: [
      { code: "en", label: "English", flag: "gb", dir: "ltr", live: true },
    ],
  };

  function sanitizeLangCode(raw) {
    var s = String(raw || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(s)) return null;
    return s;
  }

  function getLangCodesLive() {
    var list = STBARAB_I18N_MANIFEST && STBARAB_I18N_MANIFEST.languages;
    if (!list || !list.length) {
      return STBARAB_I18N_FALLBACK_MANIFEST.languages
        .filter(function (x) {
          return x.live !== false;
        })
        .map(function (x) {
          return x.code;
        });
    }
    return list
      .filter(function (x) {
        return x.live !== false;
      })
      .map(function (x) {
        return x.code;
      });
  }

  function getLangMeta(code) {
    var san = sanitizeLangCode(code);
    if (!san) return null;
    var list = STBARAB_I18N_MANIFEST && STBARAB_I18N_MANIFEST.languages;
    if (!list || !list.length) list = STBARAB_I18N_FALLBACK_MANIFEST.languages;
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].code === san) return list[i];
    }
    return null;
  }

  function defaultLangCode() {
    var codes = getLangCodesLive();
    if (!codes.length) return "en";
    if (codes.indexOf("en") >= 0) return "en";
    return codes[0];
  }

  function loadTranslationsManifest() {
    return fetch(dataJsonUrl("data/translations_manifest.json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      })
      .then(function (payload) {
        if (payload && Array.isArray(payload.languages) && payload.languages.length) {
          STBARAB_I18N_MANIFEST = payload;
        } else {
          STBARAB_I18N_MANIFEST = STBARAB_I18N_FALLBACK_MANIFEST;
        }
        return STBARAB_I18N_MANIFEST;
      });
  }

  function headerLangFlagImgHtml(flagCode) {
    var fc = String(flagCode || "xx")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (!fc || fc.length !== 2) fc = "xx";
    return (
      '<span class="header-lang__flag header-lang__flag--text" aria-hidden="true">' +
      escapeHtml(fc.toUpperCase()) +
      "</span>"
    );
  }

  function updateHeaderLangSelectedState(code) {
    var menu = document.getElementById("header-lang-menu");
    var san = sanitizeLangCode(code);
    if (!menu || !san) return;
    $all("[data-lang]", menu).forEach(function (btn) {
      var c = sanitizeLangCode(btn.getAttribute("data-lang"));
      var active = c === san;
      btn.classList.toggle("is-selected", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderHeaderLangMenu() {
    var menu = document.getElementById("header-lang-menu");
    if (!menu) return;
    var list = STBARAB_I18N_MANIFEST && STBARAB_I18N_MANIFEST.languages;
    if (!list || !list.length) list = STBARAB_I18N_FALLBACK_MANIFEST.languages;
    var parts = [];
    list.forEach(function (lang) {
      if (lang.live === false) return;
      var code = sanitizeLangCode(lang.code);
      if (!code) return;
      var idSuffix = code.replace(/[^a-z0-9]+/gi, "-");
      parts.push(
        '<button type="button" role="option" class="header-lang__option" data-lang="' +
          escapeAttr(code) +
          '" id="header-lang-' +
          escapeAttr(idSuffix) +
          '">' +
          headerLangFlagImgHtml(lang.flag) +
          "<span>" +
          escapeHtml(lang.label || code) +
          "</span></button>",
      );
    });
    menu.innerHTML = parts.join("");
    updateHeaderLangSelectedState(getStoredLang());
  }

  function getStoredLang() {
    try {
      localStorage.removeItem(STBARAB_LANG_STORAGE_KEY);
    } catch (e) {}
    return "en";
  }

  function setStoredLang(code) {
    var san = sanitizeLangCode(code);
    if (san && san !== "en") return;
    try {
      localStorage.setItem(STBARAB_LANG_STORAGE_KEY, "en");
    } catch (e) {}
  }

  function translationGet(path) {
    var o = STBARAB_I18N_TREE;
    if (!path || !o) return null;
    var parts = String(path).split(".");
    var i;
    for (i = 0; i < parts.length; i++) {
      if (!o || typeof o !== "object") return null;
      o = o[parts[i]];
    }
    return typeof o === "string" ? o : null;
  }

  function translationTx(key, fallback) {
    var v = translationGet(key);
    return v != null && v !== "" ? v : fallback;
  }

  function spawnRatesDocumentTitle() {
    return translationTx("spawnRatesPage.docTitle", "Spawn Rate Calculator") + " - " + BASE_TITLE;
  }

  function adminMachineDocumentTitle() {
    return translationTx("adminMachinePage.docTitle", "Admin Machine") + " - " + BASE_TITLE;
  }

  function adminMachineBoostLuckLabel(amount) {
    return translationTx("adminMachinePage.boostLuckTemplate", "Luck ({amount})").replace(/\{amount\}/g, String(amount));
  }

  function adminMachineCountdownLabelForDisplay(storedLabel) {
    var fb =
      typeof storedLabel === "string" && storedLabel.trim() !== ""
        ? storedLabel.trim()
        : "Next rotation starts in";
    return translationTx("adminMachinePage.countdownFallback", fb);
  }

  function statsDocumentTitle() {
    return translationTx("statsPage.docTitle", "Stats") + " - " + BASE_TITLE;
  }

  function rebirthDocumentTitle() {
    return translationTx("rebirthPage.docTitle", "Rebirth") + " - " + BASE_TITLE;
  }

  function brainrotsDocumentTitle() {
    return translationTx("brainrotsPage.docTitle", "Brainrots") + " - " + BASE_TITLE;
  }

  function blogDocumentTitle() {
    return translationTx("blogPage.docTitle", "Blog") + " - " + BASE_TITLE;
  }

  function codesDocumentTitle() {
    return translationTx("codesPage.docTitle", "Codes") + " - " + BASE_TITLE;
  }

  function collectionDocumentTitle() {
    return translationTx("collectionPage.docTitle", "Collection Tracker") + " - " + BASE_TITLE;
  }

  function eternalMachineDocumentTitle() {
    return translationTx("eternalMachinePage.docTitle", "Eternal Machine") + " - " + BASE_TITLE;
  }

  function shopDocumentTitle() {
    return translationTx("shopPage.docTitle", "Shop") + " - " + BASE_TITLE;
  }

  function creditsDocumentTitle() {
    return translationTx("creditsPage.docTitle", "Credits") + " - " + BASE_TITLE;
  }

  function loadSiteI18nBundle(code) {
    var san = sanitizeLangCode(code) || defaultLangCode();
    var meta = getLangMeta(san);
    if (!meta || meta.live === false) san = defaultLangCode();
    return fetch(dataJsonUrl("translations/" + san + ".json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (payload) {
        if (payload && payload.translations && typeof payload.translations === "object") {
          STBARAB_I18N_TREE = payload.translations;
        } else {
          STBARAB_I18N_TREE = null;
        }
        return STBARAB_I18N_TREE;
      })
      .catch(function () {
        STBARAB_I18N_TREE = null;
        return null;
      });
  }

  function applyDocumentLangDirection(code) {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }

  function applySiteI18n(root) {
    var scope = root || document.body;
    if (!scope || !STBARAB_I18N_TREE) return;
    $all("[data-i18n]", scope).forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = translationGet(key);
      if (val != null && val !== "") el.textContent = val;
    });
    $all("[data-i18n-aria]", scope).forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      var val = translationGet(key);
      if (val != null && val !== "") el.setAttribute("aria-label", val);
    });
    $all("[data-i18n-title]", scope).forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      var val = translationGet(key);
      if (val != null && val !== "") el.setAttribute("title", val);
    });
    $all("[data-i18n-alt]", scope).forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      var val = translationGet(key);
      if (val != null && val !== "") el.setAttribute("alt", val);
    });
    $all("[data-i18n-placeholder]", scope).forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var val = translationGet(key);
      if (val != null && val !== "") el.setAttribute("placeholder", val);
    });
  }

  function wireLanguageSwitcher() {
    var wrap = document.getElementById("header-lang");
    var trigger = document.getElementById("header-lang-trigger");
    var menu = document.getElementById("header-lang-menu");
    if (!wrap || !trigger || !menu) return;
    function closeMenu() {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      wrap.classList.remove("header-lang--open");
    }
    function openMenu() {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      wrap.classList.add("header-lang--open");
    }
    function toggleMenu() {
      if (menu.hidden) openMenu();
      else closeMenu();
    }
    if (wrap.getAttribute("data-lang-switch-wired") !== "1") {
      wrap.setAttribute("data-lang-switch-wired", "1");
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleMenu();
      });
      menu.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("[data-lang]");
        if (!btn || !menu.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        var code = btn.getAttribute("data-lang");
        var san = sanitizeLangCode(code);
        if (!san || getLangCodesLive().indexOf(san) < 0) return;
        setStoredLang(san);
        updateHeaderLangSelectedState(san);
        loadSiteI18nBundle(san).then(function () {
          applySiteI18n(document.body);
          applyDocumentLangDirection(san);
          $all("[data-spa-path]").forEach(function (el) {
            el.setAttribute("href", spaHref(el.getAttribute("data-spa-path")));
          });
          applyHeaderApiLinks();
          closeMenu();
          try {
            renderRoute();
          } catch (err) {}
        });
      });
      document.addEventListener(
        "pointerdown",
        function (e) {
          if (menu.hidden) return;
          if (wrap.contains(e.target)) return;
          closeMenu();
        },
        true
      );
      wrap.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
  }

  function formatCompact(n) {
    var num =
      typeof n === "number" && n === n
        ? n
        : n != null && String(n).trim() !== ""
          ? Number(String(n).trim().replace(/,/g, ""))
          : NaN;
    if (num !== num) return n != null && n !== "" ? String(n) : "";
    var sign = num < 0 ? "-" : "";
    var x = Math.abs(num);
    if (x >= 1e12) return sign + trimDec(x / 1e12) + "T";
    if (x >= 1e9) return sign + trimDec(x / 1e9) + "B";
    if (x >= 1e6) return sign + trimDec(x / 1e6) + "M";
    if (x >= 1e3) return sign + trimDec(x / 1e3) + "K";
    return sign + String(Math.round(x));
  }

  function trimDec(x) {
    return x.toFixed(2).replace(/\.?0+$/, "");
  }

  function formatMoney(n) {
    return "$" + formatCompact(n);
  }

  function formatIncomePerSec(n) {
    return "$" + formatCompact(n) + "/s";
  }

  function slugifyBrainrotNameClient(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function assignCanonicalBrainrotSlugsToClientCatalog(list) {
    if (!Array.isArray(list)) return;
    var used = Object.create(null);
    var i;
    var nStaged = 0;
    for (i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row || typeof row !== "object") continue;
      var legacy = row.slug != null ? String(row.slug).trim() : "";
      var baseSlug = legacy || slugifyBrainrotNameClient(row.name) || "brainrot";
      var slug = baseSlug;
      if (used[slug]) {
        var suffix = row.id != null ? String(row.id).trim() : "";
        slug = suffix ? baseSlug + "-" + suffix : baseSlug + "-" + String(nStaged);
        while (used[slug]) slug = slug + "-x";
      }
      used[slug] = 1;
      nStaged++;
      row.slug = slug;
    }
  }

  var BRAINROT_AUDIO_STEM_ALIASES = {
    "burbaloni-lulilolli": "burbaloni-loliloli",
    "burbalona-loliloli": "burbaloni-loliloli",
    "grande-rot": "grande-lucky-rot",
  };

  function brainrotAudioStemFromRow(b) {
    if (!b || typeof b !== "object") return "";
    if (b.sound != null && String(b.sound).trim() !== "") {
      var raw = String(b.sound).trim();
      var m = raw.match(/\/([^/]+)\.(wav|m4a)$/i);
      if (m && m[1]) return m[1].toLowerCase();
    }
    if (Array.isArray(b.styles)) {
      var si;
      for (si = 0; si < b.styles.length; si++) {
        if (b.styles[si] && b.styles[si].primary && b.styles[si].slug) {
          return String(b.styles[si].slug).trim().toLowerCase();
        }
      }
      for (si = 0; si < b.styles.length; si++) {
        if (b.styles[si] && b.styles[si].slug) {
          return String(b.styles[si].slug).trim().toLowerCase();
        }
      }
    }
    if (b.slug != null && String(b.slug).trim() !== "") {
      return String(b.slug).trim().toLowerCase();
    }
    return slugifyBrainrotNameClient(b.name);
  }

  function resolveBrainrotAudioStem(stem) {
    var s = String(stem || "").trim().toLowerCase();
    if (!s) return "";
    if (BRAINROT_AUDIO_STEM_ALIASES[s]) return BRAINROT_AUDIO_STEM_ALIASES[s];
    return s;
  }

  function brainrotDefaultSoundJsonPath(b) {
    var stem = resolveBrainrotAudioStem(brainrotAudioStemFromRow(b));
    if (!stem) return "";
    return "/assets/audio/" + stem + ".wav";
  }

  function sortBrainrots(list) {
    return list.slice().sort(function (a, b) {
      var ia = rarityOrderIndex(a.rarity);
      var ib = rarityOrderIndex(b.rarity);
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name);
    });
  }

  /** Catalog grid: ascending catalog id (0, 1, 2, …). */
  function sortBrainrotsByCatalogId(list) {
    return list.slice().sort(function (a, b) {
      var aid = typeof a.id === "number" && a.id === a.id ? a.id : 1e9;
      var bid = typeof b.id === "number" && b.id === b.id ? b.id : 1e9;
      if (aid !== bid) return aid - bid;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function brainrotCatalogIdNum(b) {
    return typeof b.id === "number" && b.id === b.id ? b.id : 1e9;
  }

  function brainrotNumericIncome(b) {
    if (!b) return null;
    var n = b.incomePerSec;
    if (typeof n === "number" && n === n) return n;
    if (typeof n === "string" && n.trim() !== "") {
      var p = parseFloat(n);
      if (p === p) return p;
    }
    return null;
  }

  function formatReactionCompactCount(n) {
    var k = Math.floor(Number(n));
    if (k !== k || k < 0) return "0";
    if (k >= 1000000) return (k / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (k >= 1000) return (k / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(k);
  }

  function brainrotReactionScoreForSort(b) {
    var x = BRAINROT_RATINGS[b.slug];
    if (!x || !x.totalVotes || x.totalVotes < 1) return null;
    if (typeof x.score === "number" && x.score === x.score) return x.score;
    return null;
  }

  function brainrotReactionFireCount(b) {
    var x = BRAINROT_RATINGS[b.slug];
    if (!x || !x.reactions || typeof x.reactions !== "object") return null;
    var f = x.reactions.fire;
    return typeof f === "number" && f === f ? f : 0;
  }

  function brainrotReactionPoopCount(b) {
    var x = BRAINROT_RATINGS[b.slug];
    if (!x || !x.reactions || typeof x.reactions !== "object") return null;
    var p = x.reactions.poop;
    return typeof p === "number" && p === p ? p : 0;
  }

  /**
   * @param {typeof BRAINROTS} list
   * @param {string} mode release-date | income-best | income-worst | alphabetical | reactions-best | reactions-worst | rarity
   */
  function sortBrainrotsForGrid(list, mode) {
    var out = list.slice();
    if (mode === "release-date") {
      return out.sort(function (a, b) {
        var d = brainrotCatalogIdNum(b) - brainrotCatalogIdNum(a);
        if (d !== 0) return d;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    if (mode === "income-best") {
      return out.sort(function (a, b) {
        var ai = brainrotNumericIncome(a);
        var bi = brainrotNumericIncome(b);
        if (ai == null && bi == null) return String(a.name || "").localeCompare(String(b.name || ""));
        if (ai == null) return 1;
        if (bi == null) return -1;
        if (bi !== ai) return bi - ai;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    if (mode === "income-worst") {
      return out.sort(function (a, b) {
        var ai = brainrotNumericIncome(a);
        var bi = brainrotNumericIncome(b);
        if (ai == null && bi == null) return String(a.name || "").localeCompare(String(b.name || ""));
        if (ai == null) return 1;
        if (bi == null) return -1;
        if (ai !== bi) return ai - bi;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    if (mode === "alphabetical") {
      return out.sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    if (mode === "reactions-best") {
      return out.sort(function (a, b) {
        var sa = brainrotReactionScoreForSort(a);
        var sb = brainrotReactionScoreForSort(b);
        var fa = brainrotReactionFireCount(a);
        var fb = brainrotReactionFireCount(b);
        if (sa == null && sb == null) {
          var xa = rarityOrderIndex(a.rarity);
          var xb = rarityOrderIndex(b.rarity);
          if (xb !== xa) return xb - xa;
          return String(a.name || "").localeCompare(String(b.name || ""));
        }
        if (sa == null) return 1;
        if (sb == null) return -1;
        if (sb !== sa) return sb - sa;
        var nfa = fa == null ? -1 : fa;
        var nfb = fb == null ? -1 : fb;
        if (nfb !== nfa) return nfb - nfa;
        var ya = rarityOrderIndex(a.rarity);
        var yb = rarityOrderIndex(b.rarity);
        if (yb !== ya) return yb - ya;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    if (mode === "reactions-worst") {
      return out.sort(function (a, b) {
        var sa = brainrotReactionScoreForSort(a);
        var sb = brainrotReactionScoreForSort(b);
        var pa = brainrotReactionPoopCount(a);
        var pb = brainrotReactionPoopCount(b);
        if (sa == null && sb == null) {
          var ua = rarityOrderIndex(a.rarity);
          var ub = rarityOrderIndex(b.rarity);
          if (ua !== ub) return ua - ub;
          return String(a.name || "").localeCompare(String(b.name || ""));
        }
        if (sa == null) return 1;
        if (sb == null) return -1;
        if (sa !== sb) return sa - sb;
        var npa = pa == null ? -1 : pa;
        var npb = pb == null ? -1 : pb;
        if (npb !== npa) return npb - npa;
        var va = rarityOrderIndex(a.rarity);
        var vb = rarityOrderIndex(b.rarity);
        if (va !== vb) return va - vb;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    if (mode === "rarity") {
      return out.sort(function (a, b) {
        var ia = rarityOrderIndex(a.rarity);
        var ib = rarityOrderIndex(b.rarity);
        if (ib !== ia) return ib - ia;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    }
    return out.sort(function (a, b) {
      var ia = rarityOrderIndex(a.rarity);
      var ib = rarityOrderIndex(b.rarity);
      if (ib !== ia) return ib - ia;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  /** Fisher–Yates shuffle (copy). */
  function shuffleArray(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function getBrainrotSortMode() {
    var el = $("#brainrot-sort");
    var v = el && el.value ? String(el.value) : "rarity";
    if (v === "reactions") v = "reactions-best";
    if (
      v === "release-date" ||
      v === "income-best" ||
      v === "income-worst" ||
      v === "alphabetical" ||
      v === "reactions-best" ||
      v === "reactions-worst" ||
      v === "rarity"
    ) {
      return v;
    }
    return "rarity";
  }

  function initialGlyph(name) {
    var s = String(name == null ? "" : name);
    var chars = Array.from(s);
    return chars[0] || "?";
  }

  function brainrotIconUrl(b) {
    if (!b || typeof b !== "object") {
      b = { slug: "fishini-bossini" };
    }
    if (b.icon) return b.icon;
    var slug =
      b.slug != null && String(b.slug).trim() !== ""
        ? String(b.slug).trim()
        : "fishini-bossini";
    return (
      BRAINROT_ICON_BASE +
      "/types/default/" +
      encodeURIComponent(slug) +
      ".png"
    );
  }

  /**
   * @returns {{ rawSheet: string, stem: string, legacy: string, icons: string }}
   */
  /** Folder segment under assets/images/brainrots/types/ (case-sensitive hosts). */
  function brainrotsTypeAssetFolder(folderSlug) {
    var s = String(folderSlug || "").trim();
    if (s.toLowerCase() === "crystal") return "Crystal";
    return s;
  }

  function typeIconResolveParts(b, t) {
    var rawSheet = t.sheet != null && String(t.sheet).trim() !== "" ? String(t.sheet).trim() : "";
    var stem = rawSheet ? rawSheet : String(b.slug);
    var folderSlug = t.slug === "rainbow" ? "default" : t.slug;
    if (rawSheet.indexOf("/") >= 0) {
      var parts = rawSheet.split("/").filter(Boolean);
      if (parts.length >= 2) {
        stem = parts.pop();
        folderSlug = parts.join("/");
      }
    } else if (t.sheetFolder != null && String(t.sheetFolder).trim() !== "") {
      folderSlug = String(t.sheetFolder).trim();
    } else {
      var inferred = inferTypeFolderFromSheetStem(stem);
      if (inferred) folderSlug = inferred;
    }
    var legacy =
      BRAINROT_ICON_BASE +
      "/types/" +
      encodeURIComponent(brainrotsTypeAssetFolder(folderSlug)) +
      "/" +
      encodeURIComponent(stem) +
      ".png";
    var icons = "";
    if (rawSheet && rawSheet.indexOf("/") < 0 && !/^Crystal/i.test(String(stem))) {
      var iconsDir = String(stem).replace(/\d+$/, "");
      if (iconsDir) icons = "/assets/images/Icons/" + iconsDir + "/" + stem + ".png";
    }
    return { rawSheet: rawSheet, stem: stem, legacy: legacy, icons: icons };
  }

  function typeIconUrl(b, t) {
    if (t.icon) return t.icon;
    var parts = typeIconResolveParts(b, t);
    if (parts.icons) return parts.icons;
    return parts.legacy;
  }

  function findBrainrotType(b, typeSlug) {
    if (!b || !b.types || !typeSlug) return null;
    var m = b.types.filter(function (x) {
      return x.slug === typeSlug;
    });
    return m[0] || null;
  }

  function parseTypeMultiplier(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number" && v === v && isFinite(v)) return v;
    var n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }

  function normalizeBrainrotTypesCatalogPayload(cat) {
    if (!cat || typeof cat !== "object") return cat;
    if (!Array.isArray(cat.types)) return cat;
    for (var i = 0; i < cat.types.length; i++) {
      var t = cat.types[i];
      if (!t || typeof t !== "object") continue;
      var m = parseTypeMultiplier(t.multiplier);
      if (m != null) t.multiplier = m;
    }
    return cat;
  }

  function normalizeTypeMultsPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (Array.isArray(payload.types)) {
      for (var i = 0; i < payload.types.length; i++) {
        var t = payload.types[i];
        if (!t || typeof t !== "object") continue;
        var m = parseTypeMultiplier(t.multiplier);
        if (m != null) t.multiplier = m;
      }
    }
    return payload;
  }

  function typeMultsBySlugMap() {
    var out = Object.create(null);
    var src = TYPE_MULTS_PAYLOAD && Array.isArray(TYPE_MULTS_PAYLOAD.types) ? TYPE_MULTS_PAYLOAD.types : [];
    var i;
    for (i = 0; i < src.length; i++) {
      var t = src[i];
      if (!t || !t.slug) continue;
      var sk = String(t.slug).trim();
      if (!sk) continue;
      var m = parseTypeMultiplier(t.multiplier);
      if (m != null) out[sk] = m;
    }
    return out;
  }

  function applyTypeMultsToBrainrotTypesCatalog(cat) {
    if (!cat || typeof cat !== "object") return cat;
    var multMap = typeMultsBySlugMap();
    if (!Array.isArray(cat.types)) cat.types = [];
    var have = Object.create(null);
    var i;
    for (i = 0; i < cat.types.length; i++) {
      var row = cat.types[i];
      if (!row || !row.slug) continue;
      var slug = String(row.slug).trim();
      have[slug] = 1;
      if (multMap[slug] != null) row.multiplier = multMap[slug];
    }
    var src = TYPE_MULTS_PAYLOAD && Array.isArray(TYPE_MULTS_PAYLOAD.types) ? TYPE_MULTS_PAYLOAD.types : [];
    for (i = 0; i < src.length; i++) {
      var tm = src[i];
      if (!tm || !tm.slug) continue;
      var sk2 = String(tm.slug).trim();
      if (!sk2 || have[sk2]) continue;
      var m2 = parseTypeMultiplier(tm.multiplier);
      cat.types.push({
        slug: sk2,
        name: tm.name != null ? String(tm.name) : sk2,
        multiplier: m2 != null ? m2 : 1,
      });
      have[sk2] = 1;
    }
    return cat;
  }

  function brainrotCatalogBySlug() {
    var out = {};
    var cat = BRAINROT_TYPES_CATALOG;
    if (!cat || !Array.isArray(cat.types)) return out;
    cat.types.forEach(function (t) {
      if (t && t.slug) out[t.slug] = t;
    });
    return out;
  }

  function slugifyTypeNameForGuess(name) {
    if (name == null || String(name).trim() === "") return null;
    return String(name)
      .trim()
      .toLowerCase()
      .replace(/\s*&\s*/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function resolveBrainrotTypeSlugFromRow(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.slug != null && String(raw.slug).trim() !== "") return String(raw.slug).trim();
    var cat = BRAINROT_TYPES_CATALOG;
    var name = raw.name;
    if (name == null || String(name).trim() === "") return null;
    var want = String(name).trim().toLowerCase();
    var types = cat && Array.isArray(cat.types) ? cat.types : [];
    for (var i = 0; i < types.length; i++) {
      var ct = types[i];
      if (ct && ct.name && String(ct.name).trim().toLowerCase() === want) {
        return String(ct.slug || "").trim() || null;
      }
    }
    return slugifyTypeNameForGuess(name);
  }

  function mergeBrainrotTypeRowFromCatalog(raw) {
    var slug = resolveBrainrotTypeSlugFromRow(raw);
    if (!slug) slug = "default";
    var by = brainrotCatalogBySlug();
    var catRow = by[slug];
    var name =
      (catRow && catRow.name) ||
      (typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name : String(slug));
    var multMap = typeMultsBySlugMap();
    var mult = multMap[slug] != null ? multMap[slug] : null;
    if (mult == null) mult = parseTypeMultiplier(catRow && catRow.multiplier);
    if (mult == null) mult = parseTypeMultiplier(raw.multiplier);
    if (mult == null) mult = 1;
    var sheetIx =
      raw.sheetIndex != null && raw.sheetIndex === raw.sheetIndex
        ? raw.sheetIndex
        : raw.iconIndex != null && raw.iconIndex === raw.iconIndex
          ? raw.iconIndex
          : undefined;
    return {
      slug: slug,
      name: name,
      multiplier: mult,
      sheet: raw.sheet,
      sheetFolder: raw.sheetFolder,
      sheetIndex: sheetIx,
      icon: raw.icon,
    };
  }

  function applyBrainrotTypeCatalogMerge() {
    if (!BRAINROTS || !BRAINROTS.length) return;
    for (var i = 0; i < BRAINROTS.length; i++) {
      var b = BRAINROTS[i];
      if (!b || !Array.isArray(b.types) || !b.types.length) continue;
      b.types = b.types.map(mergeBrainrotTypeRowFromCatalog);
    }
  }

  /** Worst → best: lowest multiplier first. Ties: name/slug A–Z. Missing multiplier sorts last. */
  function sortTypeRowsByMultiplierAsc(rows) {
    if (!rows || !rows.length) return [];
    function multKey(x) {
      var slug = x && x.slug != null ? String(x.slug).trim() : "";
      if (slug) {
        var cm = getCatalogTypeMultiplier(slug);
        if (typeof cm === "number" && cm === cm) return cm;
      }
      var m = parseTypeMultiplier(x && x.multiplier);
      return m != null ? m : Infinity;
    }
    function labelKey(x) {
      return String((x && (x.name != null ? x.name : x.slug)) || "")
        .toLowerCase()
        .trim();
    }
    return rows.slice().sort(function (a, b) {
      var ma = multKey(a);
      var mb = multKey(b);
      if (ma !== mb) return ma - mb;
      return labelKey(a).localeCompare(labelKey(b));
    });
  }

  /**
   * 9×9 (or catalog defaultCols/Rows) sheet PNG + cell when brainrot_icon_sheets.json is not used.
   * @returns {{ src: string, cols: number, rows: number, index: number } | null}
   */
  function resolveBrainrotTypeGridSprite(b, typeSlug) {
    var ts = typeSlug || "default";
    var t = findBrainrotType(b, ts);
    if (!t || t.sheet == null || String(t.sheet).trim() === "") return null;
    if (t.icon != null && String(t.icon).trim() !== "") return null;
    var meta = BRAINROT_TYPES_CATALOG || {};
    var cols = typeof meta.defaultCols === "number" ? meta.defaultCols : 9;
    var rows = typeof meta.defaultRows === "number" ? meta.defaultRows : 9;
    var base = typeof meta.iconIndexBase === "number" ? meta.iconIndexBase : 1;

    var idx;
    if (t.sheetIndex != null && t.sheetIndex === t.sheetIndex) {
      idx = t.sheetIndex;
      if (base === 1) idx = t.sheetIndex - 1;
    } else if (typeof b.itemSheetIndex === "number") {
      idx = b.itemSheetIndex;
      if (base === 1) idx = b.itemSheetIndex - 1;
    } else if (typeof b.iconIndex === "number") {
      idx = b.iconIndex;
      if (base === 1) idx = b.iconIndex - 1;
    } else if (typeof b.iconSlot === "number") {
      idx = Math.floor(b.iconSlot);
    } else {
      return null;
    }

    var maxCell = cols * rows - 1;
    idx = Math.max(0, Math.min(maxCell, Math.floor(idx)));
    var parts = typeIconResolveParts(b, t);
   
    var primary = parts.legacy;
    var fallbackSrc = parts.icons && parts.icons !== parts.legacy ? parts.icons : "";
    return {
      src: assetUrlPath(String(primary).replace(/^\/+/, "")),
      fallbackSrc: fallbackSrc ? assetUrlPath(String(fallbackSrc).replace(/^\/+/, "")) : "",
      cols: cols,
      rows: rows,
      index: idx,
    };
  }

  function resolveBrainrotTypeSpriteAny(b, typeSlug) {
    return resolveBrainrotTypeGridSprite(b, typeSlug) || resolveSpriteAtlas(b, typeSlug);
  }

  /** After innerHTML, wire load/error for tiny probe images (cached loads skip `onload` unless we check `.complete`). */
  function hydrateBrainrotAtlasProbes(root) {
    if (!root || !root.querySelectorAll) return;
    var probes = root.querySelectorAll("img.brainrot-thumb__atlas-probe");
    for (var i = 0; i < probes.length; i++) {
      (function (probe) {
        var thumb = probe.closest(".brainrot-thumb");
        function onOk() {
          if (thumb) thumb.classList.add("has-img");
        }
        function applyFallbackSheet() {
          var alt = probe.getAttribute("data-fallback-src");
          if (!alt || probe.getAttribute("data-em-atlas-fb") === "1") return false;
          probe.setAttribute("data-em-atlas-fb", "1");
          probe.src = alt;
          var fr = probe.closest(".brainrot-thumb__atlas-frame");
          var slice = fr && fr.querySelector(".brainrot-thumb__atlas-slice");
          if (slice) {
            var cols = Math.max(1, parseInt(slice.getAttribute("data-em-cols") || "9", 10));
            var rows = Math.max(1, parseInt(slice.getAttribute("data-em-rows") || "9", 10));
            var idx = Math.max(
              0,
              Math.min(cols * rows - 1, parseInt(slice.getAttribute("data-em-idx") || "0", 10))
            );
            var col = idx % cols;
            var row = Math.floor(idx / cols);
            var posX = cols <= 1 ? "0%" : (100 * col) / (cols - 1) + "%";
            var posY = rows <= 1 ? "0%" : (100 * row) / (rows - 1) + "%";
            var sizeW = cols * 100 + "%";
            var sizeH = rows * 100 + "%";
            slice.style.backgroundImage = "url(" + JSON.stringify(String(alt)) + ")";
            slice.style.backgroundSize = sizeW + " " + sizeH;
            slice.style.backgroundPosition = posX + " " + posY;
            slice.style.backgroundRepeat = "no-repeat";
          }
          return true;
        }
        function onFail() {
          if (applyFallbackSheet()) {
            if (probe.complete) {
              if (probe.naturalWidth > 0) {
                onOk();
              } else {
                finishFail();
              }
            } else {
              probe.addEventListener("load", onOk, { once: true });
              probe.addEventListener("error", finishFail, { once: true });
            }
            return;
          }
          finishFail();
        }
        function finishFail() {
          var fr = probe.closest(".brainrot-thumb__atlas-frame");
          if (fr) fr.remove();
          if (thumb) thumb.classList.remove("has-img");
        }
        if (probe.complete) {
          if (probe.naturalWidth > 0) {
            onOk();
          } else {
            onFail();
          }
        } else {
          probe.addEventListener("load", onOk);
          probe.addEventListener("error", onFail);
        }
      })(probes[i]);
    }
  }

  /**
   * Composite sheet + cell index (see data/brainrot_icon_sheets.json). Falls back to PNG URLs.
   * @param {{ src: string, cols: number, rows: number, index: number }} atlas
   */
  function spriteAtlasThumbInnerHtml(name, atlas, opts) {
    opts = opts || {};
    var imgClass = opts.imgClass || "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas";
    var sliceClass =
      String(imgClass)
        .replace(/\bbrainrot-thumb__img\b/g, "")
        .replace(/\bbrainrot-thumb__sprite\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (sliceClass) sliceClass += " ";
    sliceClass += "brainrot-thumb__atlas-slice";
    var fallbackClass = opts.fallbackClass || "brainrot-thumb__fallback";
    var cols = Math.max(1, Math.floor(Number(atlas.cols) || 1));
    var rows = Math.max(1, Math.floor(Number(atlas.rows) || 1));
    var idx = Math.max(0, Math.min(cols * rows - 1, Math.floor(Number(atlas.index) || 0)));
    var col = idx % cols;
    var row = Math.floor(idx / cols);
    var posX = cols <= 1 ? "0%" : (100 * col) / (cols - 1) + "%";
    var posY = rows <= 1 ? "0%" : (100 * row) / (rows - 1) + "%";
    var sizeW = cols * 100 + "%";
    var sizeH = rows * 100 + "%";
    return (
      '<span class="brainrot-thumb__atlas-frame" style="position:absolute;inset:0;overflow:hidden;z-index:2;">' +
      '<span class="' +
      escapeHtml(sliceClass) +
      '" style="position:absolute;inset:0;display:block;background-color:transparent;background-image:url(' +
      cssUrlForInlineStyle(atlas.src) +
      ");background-repeat:no-repeat;background-size:" +
      sizeW +
      " " +
      sizeH +
      ";background-position:" +
      posX +
      " " +
      posY +
      ';" data-em-cols="' +
      escapeHtml(String(cols)) +
      '" data-em-rows="' +
      escapeHtml(String(rows)) +
      '" data-em-idx="' +
      escapeHtml(String(idx)) +
      '" role="img" aria-label="' +
      escapeAttr(name) +
      '"></span>' +
      "<img " +
      'src=' +
      JSON.stringify(atlas.src) +
      (atlas.fallbackSrc
        ? " data-fallback-src=" + JSON.stringify(atlas.fallbackSrc)
        : "") +
      ' alt="" class="brainrot-thumb__atlas-probe" decoding="async" loading="eager" ' +
      'style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;" />' +
      "</span>" +
      '<span class="' +
      escapeHtml(fallbackClass) +
      '">' +
      escapeHtml(initialGlyph(name)) +
      "</span>"
    );
  }

  /**
   * @returns {{ src: string, cols: number, rows: number, index: number } | null}
   */
  function resolveSpriteAtlas(b, typeSlug) {
    var cfg = BRAINROT_ICON_SHEETS;
    if (!cfg || !cfg.enabled || !cfg.atlases) return null;
    if (!b || typeof b !== "object") return null;
    var ts = typeSlug || "default";
    var tsLookup = ts === "" ? "default" : ts;
    var trow = findBrainrotType(b, tsLookup);
    var atlasKey;
    if (trow && trow.sheet != null && String(trow.sheet).trim() !== "") {
      var sk = String(trow.sheet).trim();
      atlasKey = sk.indexOf("/") >= 0 ? sk.split("/").filter(Boolean).pop() : sk;
    } else if ((tsLookup === "default" || ts === "") && b.iconSheet) {
      atlasKey = b.iconSheet;
    } else {
      atlasKey =
        (cfg.typeToAtlasKey && cfg.typeToAtlasKey[tsLookup]) ||
        (cfg.typeToAtlasKey && cfg.typeToAtlasKey.default) ||
        "Default";
    }
    var def = cfg.atlases[atlasKey];
    if (!def || !def.src) return null;

    var base = typeof cfg.iconIndexBase === "number" ? cfg.iconIndexBase : 0;
    var idx;
    if (trow && typeof trow.sheetIndex === "number" && trow.sheetIndex === trow.sheetIndex) {
      idx = trow.sheetIndex;
      if (base === 1) idx = trow.sheetIndex - 1;
    } else if (typeof b.itemSheetIndex === "number" && b.itemSheetIndex === b.itemSheetIndex) {
      idx = b.itemSheetIndex;
      if (base === 1) idx = b.itemSheetIndex - 1;
    } else if (typeof b.iconIndex === "number" && b.iconIndex === b.iconIndex) {
      idx = b.iconIndex;
      if (base === 1) idx = b.iconIndex - 1;
    } else if (typeof b.iconSlot === "number") {
      idx = b.iconSlot;
    } else {
      return null;
    }

    var cols = Math.max(1, Math.floor(Number(def.cols) || 1));
    var rows = Math.max(1, Math.floor(Number(def.rows) || 1));
    var maxCell = cols * rows - 1;
    idx = Math.max(0, Math.min(maxCell, Math.floor(idx)));
    return {
      src: assetUrlPath(String(def.src).replace(/^\/+/, "")),
      fallbackSrc: "",
      cols: cols,
      rows: rows,
      index: idx,
    };
  }

  /**
   * @param {string} typeSlug e.g. default | gold (for catalog use "default")
   */
  function brainrotThumbMediaHtml(name, b, typeSlug, opts) {
    opts = opts || {};
    var ts = typeSlug || "default";
    var atlas = opts.noAtlas ? null : resolveBrainrotTypeSpriteAny(b, ts);
    if (atlas) {
      return spriteAtlasThumbInnerHtml(name, atlas, opts);
    }
    var tsLookup = ts === "" ? "default" : ts;
    var t = findBrainrotType(b, tsLookup);
    if (t && tsLookup !== "default") {
      return thumbInnerHtml(name, typeIconUrl(b, t), opts);
    }
    return thumbInnerHtml(name, brainrotIconUrl(b), opts);
  }

  /**
   * @param {string} name
   * @param {string} iconUrl
   * @param {{ imgClass?: string, fallbackClass?: string }} [opts]
   */
  function thumbInnerHtml(name, iconUrl, opts) {
    opts = opts || {};
    var imgClass = opts.imgClass || "brainrot-thumb__img";
    var fallbackClass = opts.fallbackClass || "brainrot-thumb__fallback";
    var loading = opts.loading === "eager" ? "eager" : "lazy";
    var decoding = opts.decoding === "sync" ? "sync" : "async";
    var src = publicAssetSrc(iconUrl);
    return (
      '<img class="' +
      imgClass +
      '" src="' +
      escapeHtml(src) +
      '" alt="" loading="' +
      loading +
      '" decoding="' +
      decoding +
      '" onload="this.parentElement.classList.add(\'has-img\')" onerror="this.remove()" />' +
      '<span class="' +
      fallbackClass +
      '">' +
      escapeHtml(initialGlyph(name)) +
      "</span>"
    );
  }

  function spaHref(path) {
    if (!path || path === "") path = "/";
    if (path[0] !== "/") path = "/" + path;
    if (USE_HASH) return "#" + path;
    return getAppPathPrefix() + path;
  }

  function getPath() {
    if (USE_HASH) {
      var h = location.hash.replace(/^#/, "");
      if (!h) return "/";
      return h[0] === "/" ? h : "/" + h;
    }
    var p = location.pathname;
    if (p.endsWith("/index.html")) {
      p = p.replace(/\/index\.html$/, "") || "/";
    }
    var prefix = getAppPathPrefix();
    if (prefix && p.indexOf(prefix) === 0) {
      p = p.slice(prefix.length);
      if (!p || p.charAt(0) !== "/") {
        p = "/" + (p || "");
      }
    }
    p = p.replace(/\/$/, "") || "/";
    return p;
  }

  function parseRoute(path) {
    path = path.replace(/\/$/, "") || "/";
    if (path.length > 1 && path.indexOf("?") >= 0) {
      path = path.split("?")[0] || "/";
    }
    if (path === "/") return { view: "home" };
    if (path === "/map") return { view: "map", focusMap: true };
    if (path === "/stats") return { view: "stats" };
    if (path === "/type-mults" || path === "/type-mult" || path === "/type-multipliers") {
      return { view: "type-mults" };
    }
    if (path === "/admin-machine") return { view: "admin-machine" };
    if (path === "/boxrots" || path === "/box-rot" || path === "/box-rots") return { view: "boxrots" };
    if (path === "/eternal-machine") return { view: "eternal-machine" };
    if (path === "/rebirth" || path === "/rebrith") return { view: "rebirth" };
    if (path === "/luckyrots" || path === "/lucky-rots") return { view: "luckyrots" };
    if (path === "/wheel") return { view: "wheel" };
    if (path === "/traits") return { view: "traits" };
    if (path === "/income") return { view: "income" };
    if (path === "/llamarots" || path === "/llama-rots") return { view: "llamarots" };
    if (path === "/collection") return { view: "collection" };
    if (path === "/shop") return { view: "shop" };
    if (path === "/settings") return { view: "settings" };
    var blogMatch = /^\/blog\/([^/]+)$/.exec(path);
    if (blogMatch) return { view: "blog-detail", postId: decodeURIComponent(blogMatch[1]) };
    if (path === "/blog") return { view: "blog" };
    if (path === "/codes") return { view: "codes" };
    if (path === "/events" || path === "/event") return { view: "events" };
    if (path === "/credits") return { view: "credits" };
    if (path === "/404") return { view: "notfound" };
    if (/^\/spawn-rates$/i.test(path)) return { view: "spawn-rates" };
    if (path === "/compare" || path === "/brainrots/compare") return { view: "notfound", path: path };
    if (/^\/compare\/[^/]+\/[^/]+$/.test(path)) return { view: "notfound", path: path };
    if (path === "/brainrots") return { view: "brainrots" };
    if (path === "/brainrots/type-mults") return { view: "type-mults" };
    var m = /^\/brainrots\/([^/]+)$/.exec(path);
    if (m) return { view: "detail", slug: decodeURIComponent(m[1]) };
    return { view: "notfound", path: path };
  }

  function navigate(path) {
    var siteBrand = document.getElementById("site-brand");
    if (siteBrand) siteBrand.classList.remove("site-brand--open");
    var siteBrandToggle = document.getElementById("site-brand-toggle");
    if (siteBrandToggle) siteBrandToggle.setAttribute("aria-expanded", "false");
    if (!path || path === "") path = "/";
    if (path[0] !== "/") path = "/" + path;
    if (USE_HASH) {
      location.hash = "#" + path;
      renderRoute();
    } else {
      history.pushState(null, "", getAppPathPrefix() + path);
      renderRoute();
    }
  }

  window.STBARAB_NAVIGATE = function (p) {
    navigate(p);
  };

  function showView(name) {
    $all(".view").forEach(function (el) {
      el.hidden = el.getAttribute("data-view") !== name;
    });
  }

  function scrollMainNavActiveIntoViewCenter() {
    var strip = document.querySelector(".main-nav__scroll");
    if (!strip || strip.scrollWidth <= strip.clientWidth + 2) return;
    var active = strip.querySelector(".nav-tab.is-active");
    if (!active) return;
    var stripRect = strip.getBoundingClientRect();
    var activeRect = active.getBoundingClientRect();
    var contentLeft = strip.scrollLeft + (activeRect.left - stripRect.left);
    var activeMid = contentLeft + activeRect.width / 2;
    var target = activeMid - strip.clientWidth / 2;
    var maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
    var left = Math.max(0, Math.min(target, maxScroll));
    var instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: left, behavior: instant ? "auto" : "smooth" });
  }

  function updateNavActive(route) {
    $all(".nav-tab[data-nav]").forEach(function (btn) {
      var nav = btn.getAttribute("data-nav");
      var active =
        (route.view === "home" && nav === "home") ||
        (route.view === "map" && nav === "map") ||
        (route.view === "stats" && nav === "stats") ||
        (route.view === "admin-machine" && nav === "admin-machine") ||
        (route.view === "boxrots" && nav === "boxrots") ||
        (route.view === "eternal-machine" && nav === "eternal-machine") ||
        (route.view === "shop" && nav === "shop") ||
        (route.view === "rebirth" && nav === "rebirth") ||
        (route.view === "luckyrots" && nav === "luckyrots") ||
        (route.view === "wheel" && nav === "wheel") ||
        (route.view === "traits" && nav === "traits") ||
        (route.view === "income" && nav === "income") ||
        (route.view === "llamarots" && nav === "llamarots") ||
        (route.view === "brainrots" && nav === "brainrots") ||
        (route.view === "income" && nav === "brainrots") ||
        (route.view === "traits" && nav === "brainrots") ||
        (route.view === "type-mults" && nav === "brainrots") ||
        (route.view === "spawn-rates" && nav === "spawn-rates") ||
        (route.view === "detail" && nav === "brainrots") ||
        (route.view === "collection" && nav === "collection") ||
        (route.view === "blog" && nav === "blog") ||
        (route.view === "blog-detail" && nav === "blog") ||
        (route.view === "codes" && nav === "codes") ||
        (route.view === "events" && nav === "events") ||
        (route.view === "credits" && nav === "credits");
      btn.classList.toggle("is-active", active);
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(scrollMainNavActiveIntoViewCenter);
    });
  }

  function setMainLayoutForRoute(route) {
    var main = document.querySelector(".main");
    if (!main) return;
    var isMapView = !!(route && route.view === "map");
    main.classList.toggle("main--wide", isMapView);
    document.body.classList.toggle("body-map-view", isMapView);
  }

  function normalizeMapPoint(o) {
    if (!o || typeof o !== "object") return null;
    var x = typeof o.x === "number" ? o.x : parseFloat(o.x);
    var y = typeof o.y === "number" ? o.y : parseFloat(o.y);
    if (x !== x || y !== y) return null;
    return { x: x, y: y };
  }

  function normalizeMapPayload(j) {
    if (!j || typeof j !== "object") j = {};
    function num(key) {
      var v = j[key];
      if (typeof v === "number" && v === v) return v;
      if (typeof v === "string" && String(v).trim() !== "") {
        var t = parseFloat(v);
        if (t === t) return t;
      }
      return undefined;
    }
    return {
      title: typeof j.title === "string" ? j.title : "Steal the brainrot map",
      subtitle: typeof j.subtitle === "string" ? j.subtitle : "",
      mapImage: typeof j.mapImage === "string" ? j.mapImage : "",
      homeImage: typeof j.homeImage === "string" ? j.homeImage : "",
      islandImage: typeof j.islandImage === "string" ? j.islandImage : "",
      fortniteIslandCode:
        typeof j.fortniteIslandCode === "string" ? j.fortniteIslandCode.trim() : "",
      fortniteIslandNote:
        typeof j.fortniteIslandNote === "string" ? j.fortniteIslandNote.trim() : "",
      fortniteIslandDiscoverUrl:
        typeof j.fortniteIslandDiscoverUrl === "string" ? j.fortniteIslandDiscoverUrl.trim() : "",
      minX: num("minX"),
      maxX: num("maxX"),
      minY: num("minY"),
      maxY: num("maxY"),
      startPoint: normalizeMapPoint(j.startPoint),
      endPoint: normalizeMapPoint(j.endPoint),
      spawnGroups: Array.isArray(j.spawnGroups) ? j.spawnGroups : [],
    };
  }

  function exportMapJsonDownload() {
    if (!MAP_PAGE_PAYLOAD) return;
    var out = {
      title: MAP_PAGE_PAYLOAD.title,
      subtitle: MAP_PAGE_PAYLOAD.subtitle,
      mapImage: MAP_PAGE_PAYLOAD.mapImage,
    };
    if (MAP_PAGE_PAYLOAD.homeImage) {
      out.homeImage = MAP_PAGE_PAYLOAD.homeImage;
    }
    if (MAP_PAGE_PAYLOAD.islandImage) {
      out.islandImage = MAP_PAGE_PAYLOAD.islandImage;
    }
    if (MAP_PAGE_PAYLOAD.fortniteIslandCode) {
      out.fortniteIslandCode = MAP_PAGE_PAYLOAD.fortniteIslandCode;
    }
    if (MAP_PAGE_PAYLOAD.fortniteIslandNote) {
      out.fortniteIslandNote = MAP_PAGE_PAYLOAD.fortniteIslandNote;
    }
    if (MAP_PAGE_PAYLOAD.fortniteIslandDiscoverUrl) {
      out.fortniteIslandDiscoverUrl = MAP_PAGE_PAYLOAD.fortniteIslandDiscoverUrl;
    }
    if (mapHasWorldBounds(MAP_PAGE_PAYLOAD)) {
      out.minX = MAP_PAGE_PAYLOAD.minX;
      out.maxX = MAP_PAGE_PAYLOAD.maxX;
      out.minY = MAP_PAGE_PAYLOAD.minY;
      out.maxY = MAP_PAGE_PAYLOAD.maxY;
    }
    if (MAP_PAGE_PAYLOAD.startPoint) {
      out.startPoint = { x: MAP_PAGE_PAYLOAD.startPoint.x, y: MAP_PAGE_PAYLOAD.startPoint.y };
    }
    if (MAP_PAGE_PAYLOAD.endPoint) {
      out.endPoint = { x: MAP_PAGE_PAYLOAD.endPoint.x, y: MAP_PAGE_PAYLOAD.endPoint.y };
    }
    out.spawnGroups = (MAP_PAGE_PAYLOAD.spawnGroups || []).map(function (g) {
      return {
        id: g.id,
        label: g.label,
        icon: g.icon,
        iconUrl: g.iconUrl,
        defaultOn: g.defaultOn !== false,
        points: (g.points || []).map(function (pt) {
          return { x: pt.x, y: pt.y };
        }),
      };
    });
    var a = document.createElement("a");
    a.href =
      "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out, null, 2));
    a.download = "map.json";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function mapEditAddPointForLayer(mapRoot, layerId) {
    if (!MAP_PAGE_PAYLOAD) return;
    var gid = String(layerId || "").replace(/[^a-z0-9_-]/gi, "") || "layer";
    var g = null;
    (MAP_PAGE_PAYLOAD.spawnGroups || []).forEach(function (x) {
      if (String(x.id || "") === gid) g = x;
    });
    if (!g) return;
    if (!Array.isArray(g.points)) g.points = [];
    var x;
    var y;
    if (mapHasWorldBounds(MAP_PAGE_PAYLOAD)) {
      x = (MAP_PAGE_PAYLOAD.minX + MAP_PAGE_PAYLOAD.maxX) / 2;
      y = (MAP_PAGE_PAYLOAD.minY + MAP_PAGE_PAYLOAD.maxY) / 2;
    } else {
      x = 50;
      y = 50;
    }
    g.points.push({ x: x, y: y });
    refreshMapMarkers();
  }

  /** Site path or absolute http(s) URL; respects &lt;base href&gt; like mapImage. */
  function resolveMapAssetUrl(src) {
    var s = String(src || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) {
      return assetUrlPath(s.replace(/^\/+/, ""));
    }
    return s;
  }

  /**
   * Icons for the map mirror your ImageIndex folder under <code>assets/images/</code>.
   * Priority: <code>iconUrl</code> → <code>skinsRelative</code> / <code>skins_relative_png</code>
   * → <code>verseSlug</code> / <code>verseId</code> via <code>data/verse_material_icons.json</code>.
   */
  function normalizeImageIndexRelPath(rel) {
    var s = String(rel || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    if (!s || s.indexOf("..") >= 0) return "";
    return s;
  }

  function resolveSpawnGroupIconUrl(g) {
    if (!g || typeof g !== "object") return "";
    var direct = g.iconUrl && String(g.iconUrl).trim();
    if (direct) return resolveMapAssetUrl(direct);

    var rawRel =
      (g.skinsRelative && String(g.skinsRelative).trim()) ||
      (g.skins_relative_png && String(g.skins_relative_png).trim()) ||
      "";
    var rel = normalizeImageIndexRelPath(rawRel);
    if (rel) return resolveMapAssetUrl("assets/images/" + rel);

    var slug = g.verseSlug && String(g.verseSlug).trim().toLowerCase();
    if (slug && VERSE_ICON_BY_SLUG[slug]) {
      var row = VERSE_ICON_BY_SLUG[slug];
      var png = row && row.skins_relative_png;
      if (png) {
        var r = normalizeImageIndexRelPath(png);
        if (r) return resolveMapAssetUrl("assets/images/" + r);
      }
    }

    var vid =
      typeof g.verseId === "number"
        ? g.verseId
        : typeof g.verse_id === "number"
          ? g.verse_id
          : null;
    if (vid !== null && vid === vid && VERSE_ICON_BY_ID[vid]) {
      var row2 = VERSE_ICON_BY_ID[vid];
      var png2 = row2 && row2.skins_relative_png;
      if (png2) {
        var r2 = normalizeImageIndexRelPath(png2);
        if (r2) return resolveMapAssetUrl("assets/images/" + r2);
      }
    }

    return "";
  }

  function loadVerseIconLookup(rows) {
    VERSE_ICON_BY_SLUG = {};
    VERSE_ICON_BY_ID = {};
    if (!Array.isArray(rows)) return;
    rows.forEach(function (row) {
      if (!row || typeof row !== "object") return;
      if (row.slug) VERSE_ICON_BY_SLUG[String(row.slug).toLowerCase()] = row;
      if (typeof row.id === "number") VERSE_ICON_BY_ID[row.id] = row;
    });
  }

  function buildMapPageShell(p) {
    var groups = p.spawnGroups || [];
    var toggles = groups
      .map(function (g) {
        var id = String(g.id || "").replace(/[^a-z0-9_-]/gi, "") || "layer";
        var on = g.defaultOn !== false ? " checked" : "";
        var icon = String(g.icon || "dot").replace(/[^a-z0-9_-]/gi, "") || "dot";
        var iconUrl = g.iconUrl && String(g.iconUrl).trim();
        var layerTip = escapeAttr(g.label || id);
        var iconHtml = "";
        if (iconUrl) {
          iconHtml =
            '<span class="map-spawn-toggle__icon map-spawn-toggle__icon--custom" title="' +
            layerTip +
            '"><img src="' +
            escapeHtml(resolveMapAssetUrl(iconUrl)) +
            '" alt="" title="' +
            layerTip +
            '" /></span>';
        } else {
          iconHtml =
            '<span class="map-spawn-toggle__icon map-spawn-toggle__icon--' +
            escapeHtml(icon) +
            '" title="' +
            layerTip +
            '"></span>';
        }
        return (
          '<label class="map-spawn-toggle">' +
          '<input type="checkbox" data-spawn-layer="' +
          escapeHtml(id) +
          '"' +
          on +
          "/>" +
          '<span class="map-spawn-toggle__ui" aria-hidden="true"></span>' +
          iconHtml +
          '<span class="map-spawn-toggle__label">' +
          escapeHtml(g.label || id) +
          "</span>" +
          "</label>"
        );
      })
      .join("");
    var routeLegendHtml = "";
    if (p.startPoint || p.endPoint) {
      routeLegendHtml =
        '<p class="map-route-legend" aria-label="Route markers">' +
        '<span class="map-route-legend__label">Route:</span> ' +
        '<span class="map-route-legend__chip map-route-legend__chip--start">Start</span>' +
        '<span class="map-route-legend__sep" aria-hidden="true"></span>' +
        '<span class="map-route-legend__chip map-route-legend__chip--end">End</span>' +
        "</p>";
    }
    var editToolbarHtml = "";
    if (isMapEditMode()) {
      var opts = (p.spawnGroups || [])
        .map(function (g) {
          var id = String(g.id || "").replace(/[^a-z0-9_-]/gi, "") || "layer";
          return (
            '<option value="' +
            escapeHtml(id) +
            '">' +
            escapeHtml(g.label || id) +
            "</option>"
          );
        })
        .join("");
      editToolbarHtml =
        '<div class="map-edit-toolbar" id="map-edit-toolbar">' +
        '<p class="map-edit-toolbar__hint">Drag spawn pins or <strong>START</strong>/<strong>END</strong> route markers. <strong>Shift+click</strong> a spawn pin to delete (route markers cannot be deleted here). Download <code>map.json</code> and replace <code>data/map.json</code>. Open without <code>?mapEdit=1</code> when done.</p>' +
        '<div class="map-edit-toolbar__row">' +
        '<label class="map-edit-toolbar__label">Layer</label>' +
        '<select id="map-edit-layer-select" class="map-edit-toolbar__select">' +
        opts +
        "</select>" +
        '<button type="button" class="map-edit-toolbar__btn" id="map-edit-add-point">Add point</button>' +
        "</div>" +
        '<button type="button" class="map-edit-toolbar__btn map-edit-toolbar__btn--primary" id="map-edit-export">Download map.json</button>' +
        "</div>";
    }
    var imgHtml = "";
    if (p.mapImage && String(p.mapImage).trim()) {
      imgHtml =
        '<img class="map-surface__img" src="' +
        escapeHtml(resolveMapAssetUrl(String(p.mapImage).trim())) +
        '" alt="" loading="lazy" decoding="async" />';
    }
    var frameClass = "map-surface__frame" + (imgHtml ? "" : " map-surface__frame--empty");
    return (
      '<div class="map-page-inner">' +
      '<aside class="map-sidebar" aria-label="Map filters">' +
      '<div class="map-sidebar__head">' +
      '<h1 class="map-sidebar__title">' +
      escapeHtml(p.title) +
      "</h1>" +
      (p.subtitle
        ? '<p class="map-sidebar__sub">' + escapeHtml(p.subtitle) + "</p>"
        : "") +
      routeLegendHtml +
      editToolbarHtml +
      "</div>" +
      '<div class="map-sidebar__section">' +
      '<h2 class="map-sidebar__section-title">Spawns</h2>' +
      '<div class="map-spawn-list" id="map-spawn-list">' +
      toggles +
      "</div>" +
      "</div>" +
      "</aside>" +
      '<div class="map-stage">' +
      '<button type="button" class="map-sidebar-collapse" id="map-sidebar-toggle" aria-expanded="true" aria-label="Collapse sidebar">‹</button>' +
      '<div class="map-viewport" id="map-viewport">' +
      '<div class="map-surface" id="map-surface">' +
      '<div class="' +
      frameClass +
      '">' +
      imgHtml +
      '<div class="map-markers" id="map-markers" aria-hidden="true"></div>' +
      "</div></div></div></div></div>"
    );
  }

  function scrollMapIntoView() {
    var mr = $("#map-root");
    if (!mr) return;
    requestAnimationFrame(function () {
      mr.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function readMapFocusParam() {
    var params = "";
    if (USE_HASH) {
      var h = String(location.hash || "").replace(/^#/, "");
      var qi = h.indexOf("?");
      if (qi >= 0) params = h.slice(qi + 1);
    }
    if (!params && location.search && location.search.length > 1) {
      params = location.search.slice(1);
    }
    if (!params) return "";
    try {
      return String(new URLSearchParams(params).get("mapFocus") || "")
        .trim()
        .toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function focusMapMarkerFromQuery(mapRoot) {
    var kind = readMapFocusParam();
    if (kind !== "end" && kind !== "start") return;
    var scope = mapRoot || $("#map-root");
    if (!scope) return;
    var run = function () {
      var sel =
        kind === "end"
          ? '.map-marker[data-marker-route="end"]'
          : '.map-marker[data-marker-route="start"]';
      var el = scope.querySelector(sel);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    };
    requestAnimationFrame(function () {
      requestAnimationFrame(run);
    });
  }

  function refreshMapMarkers() {
    var p = MAP_PAGE_PAYLOAD;
    var mapRoot = $("#map-root");
    var el = mapRoot ? mapRoot.querySelector("#map-markers") : $("#map-markers");
    if (!p || !el) return;
    var checks = {};
    $all("[data-spawn-layer]", mapRoot || undefined).forEach(function (cb) {
      if (cb.type === "checkbox" && cb.getAttribute("data-spawn-layer")) {
        checks[cb.getAttribute("data-spawn-layer")] = cb.checked;
      }
    });
    var edit = isMapEditMode();
    var parts = [];
    (p.spawnGroups || []).forEach(function (g) {
      var gid = String(g.id || "");
      if (!checks[gid]) return;
      var icon = String(g.icon || "dot").replace(/[^a-z0-9_-]/gi, "") || "dot";
      var iconUrl = g.iconUrl && String(g.iconUrl).trim();
      (g.points || []).forEach(function (pt, i) {
        var wx = typeof pt.x === "number" ? pt.x : parseFloat(pt.x);
        var wy = typeof pt.y === "number" ? pt.y : parseFloat(pt.y);
        if (wx !== wx || wy !== wy) return;
        var map = mapWorldToPercent(p, wx, wy);
        var lx = map.ok ? map.px : wx;
        var ly = map.ok ? map.py : wy;
        var tipRightCls = lx < 35 ? " map-marker--tip-right" : "";
        var labelPlain = g.label || gid;
        var ariaLabel = escapeAttr(labelPlain + ", index " + (i + 1));
        var hoverCard =
          '<span class="map-marker__hovercard" aria-hidden="true">' +
          '<span class="map-marker__hovercard-inner">' +
          '<span class="map-marker__hovercard-title">' +
          escapeHtml(labelPlain) +
          "</span>" +
          '<span class="map-marker__hovercard-sub">Index ' +
          (i + 1) +
          "</span>" +
          "</span></span>";
        var dragCls = edit ? " map-marker--editable" : "";
        var dataAttr =
          ' data-marker-gid="' +
          escapeAttr(gid) +
          '" data-marker-idx="' +
          i +
          '"' +
          ' data-map-pct-x="' +
          lx +
          '" data-map-pct-y="' +
          ly +
          '"' +
          ' aria-label="' +
          ariaLabel +
          '"';
        if (iconUrl) {
          parts.push(
            '<span class="map-marker map-marker--custom' +
              tipRightCls +
              dragCls +
              '"' +
              dataAttr +
              ' style="left:0;top:0">' +
              hoverCard +
              '<img class="map-marker__img" src="' +
              escapeHtml(resolveMapAssetUrl(iconUrl)) +
              '" alt="" draggable="false" /></span>'
          );
        } else {
          parts.push(
            '<span class="map-marker map-marker--' +
              escapeHtml(icon) +
              tipRightCls +
              dragCls +
              '"' +
              dataAttr +
              ' style="left:0;top:0">' +
              hoverCard +
              "</span>"
          );
        }
      });
    });
    function pushRouteMarker(routeKind, pt, labelTitle, chipText) {
      var wx = pt.x;
      var wy = pt.y;
      var map2 = mapWorldToPercent(p, wx, wy);
      var lx2 = map2.ok ? map2.px : wx;
      var ly2 = map2.ok ? map2.py : wy;
      var tipR2 = lx2 < 35 ? " map-marker--tip-right" : "";
      var rcls =
        routeKind === "start"
          ? "map-marker map-marker--route map-marker--route-start"
          : "map-marker map-marker--route map-marker--route-end";
      var rDrag = edit ? " map-marker--editable" : "";
      var rAria = escapeAttr(labelTitle + " — route");
      var rHover =
        '<span class="map-marker__hovercard" aria-hidden="true">' +
        '<span class="map-marker__hovercard-inner map-marker__hovercard-inner--route map-marker__hovercard-inner--route-' +
        routeKind +
        '">' +
        '<span class="map-marker__hovercard-title">' +
        escapeHtml(labelTitle) +
        "</span>" +
        '<span class="map-marker__hovercard-sub">Route</span>' +
        "</span></span>";
      parts.push(
        '<span class="' +
          rcls +
          tipR2 +
          rDrag +
          '" data-marker-route="' +
          routeKind +
          '" data-map-pct-x="' +
          lx2 +
          '" data-map-pct-y="' +
          ly2 +
          '" style="left:0;top:0" aria-label="' +
          rAria +
          '">' +
          rHover +
          '<span class="map-marker__route-chip">' +
          escapeHtml(chipText) +
          "</span></span>"
      );
    }
    if (p.startPoint) {
      pushRouteMarker("start", p.startPoint, "Start", "START");
    }
    if (p.endPoint) {
      pushRouteMarker("end", p.endPoint, "End", "END");
    }
    el.innerHTML = parts.join("");
    layoutMapMarkersForImageContain(mapRoot || document);
  }

  var MAP_EDIT_DRAG_STATE = null;

  function wireMapPage(root) {
    if (root.dataset.mapWire) return;
    root.dataset.mapWire = "1";
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-spawn-layer")) refreshMapMarkers();
    });
    var mapFrame = root.querySelector(".map-surface__frame");
    var mapImg = mapFrame && mapFrame.querySelector(".map-surface__img");
    if (mapImg) {
      if (mapImg.complete && mapImg.naturalWidth > 0) {
        layoutMapMarkersForImageContain(root);
      }
      mapImg.addEventListener("load", function () {
        layoutMapMarkersForImageContain(root);
        focusMapMarkerFromQuery(root);
      });
    }
    if (mapFrame && typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        layoutMapMarkersForImageContain(root);
      });
      ro.observe(mapFrame);
    }
    var btn = $("#map-sidebar-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var inner = root.querySelector(".map-page-inner");
        if (!inner) return;
        inner.classList.toggle("map-page-inner--sidebar-collapsed");
        var collapsed = inner.classList.contains("map-page-inner--sidebar-collapsed");
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
    }
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.id) return;
      if (t.id === "map-edit-export") {
        e.preventDefault();
        exportMapJsonDownload();
      }
      if (t.id === "map-edit-add-point") {
        e.preventDefault();
        var sel = root.querySelector("#map-edit-layer-select");
        var lid = sel && sel.value ? sel.value : "";
        mapEditAddPointForLayer(root, lid);
      }
    });
    root.addEventListener("mousedown", function (e) {
      if (!isMapEditMode() || !MAP_PAGE_PAYLOAD) return;
      var m = e.target.closest && e.target.closest(".map-marker.map-marker--editable");
      if (!m || !root.contains(m)) return;
      var markersBox = root.querySelector("#map-markers");
      if (!markersBox) return;
      var route = m.getAttribute("data-marker-route");
      if (route === "start" || route === "end") {
        if (e.shiftKey) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        MAP_EDIT_DRAG_STATE = {
          marker: m,
          markersBox: markersBox,
          route: route,
        };
        document.body.classList.add("map-edit-dragging");
        function onMoveRoute(ev) {
          mapEditOnDocumentMove(ev);
        }
        function onUpRoute() {
          document.removeEventListener("mousemove", onMoveRoute);
          document.removeEventListener("mouseup", onUpRoute);
          mapEditOnDocumentUp();
        }
        document.addEventListener("mousemove", onMoveRoute);
        document.addEventListener("mouseup", onUpRoute);
        return;
      }
      var gid = m.getAttribute("data-marker-gid");
      var idx = parseInt(m.getAttribute("data-marker-idx"), 10);
      if (!gid || idx !== idx) return;
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        var gDel = null;
        (MAP_PAGE_PAYLOAD.spawnGroups || []).forEach(function (x) {
          if (String(x.id || "") === gid) gDel = x;
        });
        if (!gDel || !gDel.points || idx < 0 || idx >= gDel.points.length) return;
        gDel.points.splice(idx, 1);
        refreshMapMarkers();
        return;
      }
      e.preventDefault();
      MAP_EDIT_DRAG_STATE = {
        marker: m,
        markersBox: markersBox,
        gid: gid,
        idx: idx,
      };
      document.body.classList.add("map-edit-dragging");
      function onMove(ev) {
        mapEditOnDocumentMove(ev);
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        mapEditOnDocumentUp();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function mapEditOnDocumentMove(e) {
    if (!MAP_EDIT_DRAG_STATE || !MAP_PAGE_PAYLOAD) return;
    var st = MAP_EDIT_DRAG_STATE;
    var rect = st.markersBox.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w <= 0 || h <= 0) return;
    var pfx = ((e.clientX - rect.left) / w) * 100;
    var pyf = ((e.clientY - rect.top) / h) * 100;
    if (pfx < 0) pfx = 0;
    if (pfx > 100) pfx = 100;
    if (pyf < 0) pyf = 0;
    if (pyf > 100) pyf = 100;
    var frameEl =
      st.markersBox.parentElement && st.markersBox.parentElement.classList.contains("map-surface__frame")
        ? st.markersBox.parentElement
        : null;
    var imgEl = frameEl && frameEl.querySelector(".map-surface__img");
    var metrics = mapImageContainMetrics(frameEl, imgEl);
    var logPct = mapFramePercentToLogicalPercent(pfx, pyf, metrics);
    var store = percentXYToStorage(MAP_PAGE_PAYLOAD, logPct.px, logPct.py);
    if (st.route === "start" || st.route === "end") {
      if (st.route === "start") {
        if (!MAP_PAGE_PAYLOAD.startPoint) MAP_PAGE_PAYLOAD.startPoint = { x: store.x, y: store.y };
        else {
          MAP_PAGE_PAYLOAD.startPoint.x = store.x;
          MAP_PAGE_PAYLOAD.startPoint.y = store.y;
        }
      } else {
        if (!MAP_PAGE_PAYLOAD.endPoint) MAP_PAGE_PAYLOAD.endPoint = { x: store.x, y: store.y };
        else {
          MAP_PAGE_PAYLOAD.endPoint.x = store.x;
          MAP_PAGE_PAYLOAD.endPoint.y = store.y;
        }
      }
      st.marker.style.left = pfx + "%";
      st.marker.style.top = pyf + "%";
      return;
    }
    var g = null;
    (MAP_PAGE_PAYLOAD.spawnGroups || []).forEach(function (x) {
      if (String(x.id || "") === st.gid) g = x;
    });
    if (!g || !g.points || !g.points[st.idx]) return;
    g.points[st.idx].x = store.x;
    g.points[st.idx].y = store.y;
    st.marker.style.left = pfx + "%";
    st.marker.style.top = pyf + "%";
  }

  function mapEditOnDocumentUp() {
    if (MAP_EDIT_DRAG_STATE) {
      MAP_EDIT_DRAG_STATE = null;
      document.body.classList.remove("map-edit-dragging");
      refreshMapMarkers();
    }
  }

  function renderMapPage() {
    var root = $("#map-root");
    if (!root) return;
    if (!MAP_PAGE_PAYLOAD) {
      root.removeAttribute("data-shell");
      root.removeAttribute("data-map-edit");
      root.removeAttribute("data-map-wire");
      root.innerHTML =
        '<div class="map-page-inner map-page-inner--loading"><p class="map-page-loading">Loading map…</p></div>';
      return;
    }
    var wantEdit = isMapEditMode() ? "1" : "0";
    if (root.dataset.shell !== "4" || root.dataset.mapEdit !== wantEdit) {
      root.innerHTML = buildMapPageShell(MAP_PAGE_PAYLOAD);
      root.dataset.shell = "4";
      root.dataset.mapEdit = wantEdit;
      root.removeAttribute("data-map-wire");
      wireMapPage(root);
    }
    refreshMapMarkers();
    focusMapMarkerFromQuery(root);
  }

  function findBySlug(slug) {
    return BRAINROTS.find(function (b) {
      return b.slug === slug;
    });
  }

  /** Detail URL segment: try slug, then numeric catalog id (e.g. /brainrots/0 → id 0, not slug "0"). */
  function findBrainrotForDetailPath(segment) {
    if (!BRAINROTS || !BRAINROTS.length) return null;
    var decoded = decodeURIComponent(String(segment || ""));
    if (!decoded) return null;
    var b = findBySlug(decoded);
    if (b) return b;
    if (/^\d+$/.test(decoded)) {
      return BRAINROTS.find(function (x) {
        return String(x.id) === decoded;
      });
    }
    return null;
  }

  function findByName(name) {
    return BRAINROTS.find(function (b) {
      return b.name === name;
    });
  }

  function findByNameLoose(name) {
    var n = String(name == null ? "" : name).trim();
    if (!n) return undefined;
    var b = findByName(n);
    if (b) return b;
    if (n.charAt(0) === "*") {
      return findByNameLoose(n.slice(1));
    }
    return undefined;
  }

  /** Match catalog slug when display name differs slightly from `brainrots.json` `name`. */
  function slugifyBrainrotLookupKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function findBrainrotForLink(key) {
    var b = findByNameLoose(key);
    if (b) return b;
    var slug = slugifyBrainrotLookupKey(key);
    if (!slug || !BRAINROTS || !BRAINROTS.length) return null;
    return findBySlug(slug) || null;
  }

  /**
   * Always emit a /brainrots/{slug} link when the name slugifies (catalog match optional).
   * If brainrots.json never loaded, BRAINROTS is [] and lookup used to return plain text — no links.
   */
  function linkBrainrotNameHtml(name, lookupName) {
    var label = String(name == null ? "" : name).trim();
    /** Array#map passes (item, index) — index is a number; must not be used as catalog key. */
    var key = label;
    if (
      lookupName != null &&
      typeof lookupName !== "number" &&
      String(lookupName).trim() !== ""
    ) {
      key = String(lookupName).trim();
    }
    var b = findBrainrotForLink(key);
    if (b && b.name != null && String(b.name).trim() !== "") {
      label = String(b.name).trim();
    }
    var slugFallback = slugifyBrainrotLookupKey(key);
    /** Use catalog slug in the URL (e.g. /brainrots/fishini-bossini); slugify name if no catalog row. */
    var segment = b && b.slug ? b.slug : slugFallback;
    if (!segment) return escapeHtml(label);
    var path = "/brainrots/" + encodeURIComponent(segment);
    return (
      '<a class="spa-brainrot-link" href="' +
      escapeHtml(spaHref(path)) +
      '" data-spa-path="' +
      escapeHtml(path) +
      '"><span class="spa-brainrot-link__label">' +
      escapeHtml(label) +
      "</span></a>"
    );
  }

  function rebirthCell(val) {
    if (val === null || val === undefined || val === "") return "—";
    return escapeHtml(String(val));
  }

  function formatLastUpdatedDisplay(value) {
    var raw = value == null ? "" : String(value).trim();
    if (!raw) return "";
    var normalized = raw;
    normalized = normalized.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) normalized = raw + "T00:00:00Z";
    var dt = new Date(normalized);
    if (!(dt && dt.getTime && dt.getTime() === dt.getTime())) return raw;
    var lg = document.documentElement.lang || undefined;
    try {
      return dt.toLocaleDateString(lg, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  /**
   * Shared “Last updated: …” line (grey label + bold date). Use for rebirth meta, catalog, etc.
   * @param {string} displayText shown inside <time>
   * @param {string} [datetimeAttr] value for datetime attribute (defaults to displayText)
   */
  function lastUpdatedParagraphHtml(displayText, datetimeAttr) {
    var d = displayText == null ? "" : String(displayText).trim();
    if (!d) return "";
    var display = formatLastUpdatedDisplay(d);
    var attr = datetimeAttr != null && String(datetimeAttr).trim() !== "" ? String(datetimeAttr).trim() : d;
    return (
      '<p class="page-last-updated">' +
      '<span class="page-last-updated__label">' +
      escapeHtml(translationTx("brainrotsPage.lastUpdatedLabel", "Last updated: ")) +
      "</span>" +
      '<time class="page-last-updated__date" datetime="' +
      escapeHtml(attr) +
      '">' +
      escapeHtml(display) +
      "</time></p>"
    );
  }

  function getCatalogLastUpdatedParts() {
    if (!CATALOG_META || CATALOG_META.lastUpdated == null || String(CATALOG_META.lastUpdated).trim() === "") {
      return null;
    }
    var raw = String(CATALOG_META.lastUpdated).trim();
    var display =
      CATALOG_META.lastUpdatedLabel != null && String(CATALOG_META.lastUpdatedLabel).trim() !== ""
        ? String(CATALOG_META.lastUpdatedLabel).trim()
        : raw;
    var attr =
      CATALOG_META.lastUpdatedIso != null && String(CATALOG_META.lastUpdatedIso).trim() !== ""
        ? String(CATALOG_META.lastUpdatedIso).trim()
        : raw;
    return { display: formatLastUpdatedDisplay(display), attr: attr };
  }

  /** Wrapped <p> from data/catalog_meta.json (e.g. brainrot detail). */
  function catalogLastUpdatedParagraphHtml(extraClass) {
    var parts = getCatalogLastUpdatedParts();
    if (!parts) return "";
    var cls = "page-last-updated" + (extraClass ? " " + String(extraClass).trim() : "");
    return (
      '<p class="' +
      cls +
      '">' +
      '<span class="page-last-updated__label">' +
      escapeHtml(translationTx("brainrotsPage.lastUpdatedLabel", "Last updated: ")) +
      "</span>" +
      '<time class="page-last-updated__date" datetime="' +
      escapeHtml(parts.attr) +
      '">' +
      escapeHtml(parts.display) +
      "</time></p>"
    );
  }

  function applyBrainrotsPageLastUpdated() {
    var el = $("#brainrots-page-updated");
    if (!el) return;
    var parts = getCatalogLastUpdatedParts();
    if (!parts) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.className = "page-last-updated";
    el.innerHTML =
      '<span class="page-last-updated__label">' +
      escapeHtml(translationTx("brainrotsPage.lastUpdatedLabel", "Last updated: ")) +
      "</span>" +
      '<time class="page-last-updated__date" datetime="' +
      escapeHtml(parts.attr) +
      '">' +
      escapeHtml(parts.display) +
      "</time>";
    el.hidden = false;
  }

  /** Compact name + thumb for rebirth requirement lists (table + cards). */
  function rebirthBrainrotChipHtml(name) {
    var label = String(name == null ? "" : name).trim();
    var b = findBrainrotForLink(label);
    var slugFallback = slugifyBrainrotLookupKey(label);
    var segment = b && b.slug ? b.slug : slugFallback;
    var thumbOpts = {
      imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas",
      fallbackClass: "brainrot-thumb__fallback",
    };
    var thumbHtml = "";
    if (b) {
      thumbHtml =
        '<span class="rebirth-brainrot-chip__thumb brainrot-thumb brainrot-thumb--rebirth-chip">' +
        brainrotThumbMediaHtml(label, b, "default", thumbOpts) +
        "</span>";
    }
    if (!segment) {
      return (
        '<span class="rebirth-brainrot-chip">' +
        thumbHtml +
        '<span class="rebirth-brainrot-chip__text">' +
        escapeHtml(label) +
        "</span></span>"
      );
    }
    var path = "/brainrots/" + encodeURIComponent(segment);
    return (
      '<a class="spa-brainrot-link rebirth-brainrot-chip" href="' +
      escapeHtml(spaHref(path)) +
      '" data-spa-path="' +
      escapeHtml(path) +
      '">' +
      thumbHtml +
      '<span class="spa-brainrot-link__label">' +
      escapeHtml(label) +
      "</span></a>"
    );
  }

  function normalizeChipNameList(names) {
    if (names == null) return [];
    if (Array.isArray(names)) {
      return names
        .map(function (n) {
          return n == null ? "" : String(n).trim();
        })
        .filter(Boolean);
    }
    if (typeof names === "string") {
      var s = names.trim();
      if (!s) return [];
      if (s.charAt(0) === "[" || s.charAt(0) === "{") {
        try {
          return normalizeChipNameList(JSON.parse(s));
        } catch (e) {
          return [s];
        }
      }
      return [s];
    }
    if (typeof names === "object") {
      return normalizeChipNameList(Object.values(names));
    }
    return [];
  }

  function normalizeRebirthLevelRow(row) {
    if (!row || typeof row !== "object") return null;
    var level = row.level;
    var n =
      typeof level === "number" && level === level
        ? level
        : Number(String(level == null ? "" : level).trim());
    if (n !== n) return null;
    return {
      level: n,
      money: row.money,
      brainrots: normalizeChipNameList(row.brainrots),
      initialBalance: row.initialBalance,
      moneyMult: row.moneyMult,
      lockTime: row.lockTime,
      slots: row.slots,
      gadgets: normalizeChipNameList(row.gadgets),
    };
  }

  function normalizeRebirthsPayload(r) {
    if (!r || typeof r !== "object") return { meta: {}, levels: [] };
    var levels = Array.isArray(r.levels)
      ? r.levels.map(normalizeRebirthLevelRow).filter(Boolean)
      : [];
    return { meta: r.meta || {}, levels: levels };
  }

  function rebirthBrainrotsListHtml(names) {
    var list = normalizeChipNameList(names);
    if (!list.length) return "—";
    return (
      '<ul class="rebirth-brainrot-list">' +
      list
        .map(function (n) {
          return "<li>" + rebirthBrainrotChipHtml(n) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function normalizeGadgetsPayload(g) {
    if (!g || typeof g !== "object") return null;
    return g;
  }

  function relativeChanceToNumber(x) {
    if (typeof x === "number" && x === x && x >= 0) return x;
    if (x != null && typeof x !== "boolean") {
      var n = Number(String(x).trim());
      if (n === n && n >= 0) return n;
    }
    return null;
  }

  function formatRelativeChancePercent(n) {
    var x = relativeChanceToNumber(n);
    if (x == null) return null;
    var pct = x * 100;
    if (pct === 0) return "0";
    var absPct = pct > 0 ? pct : -pct;
    var decimals = absPct >= 1 ? 3 : absPct >= 0.01 ? 4 : absPct >= 1e-6 ? 8 : 12;
    var factor = Math.pow(10, decimals);
    var rounded = Math.round(pct * factor) / factor;
    if (rounded === 0 && pct > 0) {
      decimals = Math.min(16, Math.max(8, Math.ceil(-Math.log10(pct)) + 2));
      factor = Math.pow(10, decimals);
      rounded = Math.round(pct * factor) / factor;
    }
    if (Math.abs(rounded - Math.round(rounded)) < 1e-12) return String(Math.round(rounded));
    var s = String(rounded);
    if (s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, "");
    return s;
  }

  function brainrotRowsMissingCarpetChance(rows) {
    if (!rows || !rows.length) return true;
    var i;
    for (i = 0; i < rows.length; i++) {
      var c = rows[i] && rows[i].carpetRelativeChance;
      if (!(typeof c === "number" && c === c && c >= 0)) return true;
    }
    return false;
  }

  function findCarpetRateForBrainrot(b) {
    if (!b) return null;
    var x = relativeChanceToNumber(b.carpetRelativeChance);
    if (x == null) return null;
    return formatRelativeChancePercent(x);
  }

  function luckyEntryResolvedRate(e) {
    var key =
      e && e.catalogName != null && typeof e.catalogName !== "number" && String(e.catalogName).trim() !== ""
        ? String(e.catalogName).trim()
        : e && e.name != null
          ? String(e.name).trim()
          : "";
    var b = key ? findBrainrotForLink(key) : null;
    if (b) {
      var lr = relativeChanceToNumber(b.carpetLuckyrotRelativeChance);
      if (lr != null && lr > 0) {
        var s = formatRelativeChancePercent(lr);
        if (s) return s;
      }
    }
    return e && e.rate != null ? String(e.rate).trim() : "";
  }

  function gadgetSlug(name) {
    if (GADGETS_PAYLOAD && GADGETS_PAYLOAD.slugOverrides && GADGETS_PAYLOAD.slugOverrides[name]) {
      return GADGETS_PAYLOAD.slugOverrides[name];
    }
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gadget";
  }

  function gadgetIconUrl(name) {
    var base =
      (GADGETS_PAYLOAD && GADGETS_PAYLOAD.iconBase) || "/assets/images/gadgets";
    if (GADGETS_PAYLOAD && GADGETS_PAYLOAD.icons && GADGETS_PAYLOAD.icons[name]) {
      var c = GADGETS_PAYLOAD.icons[name];
      if (/^https?:\/\//.test(c) || c.indexOf("/") === 0) return c;
      return base + "/" + encodeURIComponent(c);
    }
    var stem = null;
    if (
      GADGETS_PAYLOAD &&
      GADGETS_PAYLOAD.exportStemByGadget &&
      GADGETS_PAYLOAD.exportStemByGadget[name]
    ) {
      stem = GADGETS_PAYLOAD.exportStemByGadget[name];
    }
    if (stem) {
      return base + "/" + encodeURIComponent(stem) + ".png";
    }
    return base + "/" + encodeURIComponent(gadgetSlug(name)) + ".png";
  }

  function gadgetThumbHtml(name, opts) {
    opts = opts || {};
    var loading = opts.loading === "eager" ? "eager" : "lazy";
    var decoding = opts.decoding === "sync" ? "sync" : "async";
    var url = gadgetIconUrl(name);
    return (
      '<span class="gadget-thumb">' +
      '<img class="gadget-thumb__img" src="' +
      escapeHtml(url) +
      '" alt="" loading="' +
      loading +
      '" decoding="' +
      decoding +
      '" onload="this.parentElement.classList.add(\'has-img\')" onerror="this.remove()" />' +
      '<span class="gadget-thumb__fallback" aria-hidden="true">' +
      escapeHtml(initialGlyph(name)) +
      "</span></span>"
    );
  }

  function gadgetChipHtml(name) {
    return (
      '<span class="gadget-chip">' +
      gadgetThumbHtml(name) +
      '<span class="gadget-chip__name">' +
      escapeHtml(name) +
      "</span></span>"
    );
  }

  function gadgetChipsHtml(names) {
    var list = normalizeChipNameList(names);
    if (!list.length) return "—";
    return (
      '<span class="gadget-chip-list">' +
      list.map(gadgetChipHtml).join("") +
      "</span>"
    );
  }

  function normalizeTraitsPayload(t) {
    if (!t || typeof t !== "object") {
      return { meta: {}, rows: [], footnote: "" };
    }
    return {
      meta: t.meta || {},
      multNote: typeof t.multNote === "string" ? t.multNote : "",
      rows: Array.isArray(t.rows) ? t.rows : [],
      footnote: typeof t.footnote === "string" ? t.footnote : "",
      iconBase: t.iconBase,
      icons: t.icons,
      exportStemByTrait: t.exportStemByTrait,
    };
  }

  function formatTraitMult(mult) {
    if (mult === null || mult === undefined || mult === "") return "—";
    if (typeof mult === "string") {
      var trimmed = String(mult).trim();
      if (trimmed.charAt(0) === "+") trimmed = trimmed.slice(1).trim();
      var parsed = Number(trimmed);
      if (parsed === parsed) mult = parsed;
    }
    var n = typeof mult === "number" ? mult : Number(mult);
    if (n !== n) return String(mult).replace(/^\++/, "");
    return "+" + String(n);
  }

  function traitRateCellHtml(rate) {
    if (rate === null || rate === undefined || rate === "") {
      return '<td class="lucky-rate-cell traits-rate-cell--empty">—</td>';
    }
    return '<td class="lucky-rate-cell">' + luckyRateHtml(rate) + "</td>";
  }

  function traitStem(name) {
    if (
      TRAITS_PAYLOAD &&
      TRAITS_PAYLOAD.exportStemByTrait &&
      TRAITS_PAYLOAD.exportStemByTrait[name]
    ) {
      return TRAITS_PAYLOAD.exportStemByTrait[name];
    }
    var n = String(name || "")
      .replace(/\*+$/g, "")
      .trim();
    if (
      TRAITS_PAYLOAD &&
      TRAITS_PAYLOAD.exportStemByTrait &&
      TRAITS_PAYLOAD.exportStemByTrait[n]
    ) {
      return TRAITS_PAYLOAD.exportStemByTrait[n];
    }
    return n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trait";
  }

  function traitIconUrl(name) {
    var base = (TRAITS_PAYLOAD && TRAITS_PAYLOAD.iconBase) || "/assets/images/traits";
    if (TRAITS_PAYLOAD && TRAITS_PAYLOAD.icons && TRAITS_PAYLOAD.icons[name]) {
      var c = TRAITS_PAYLOAD.icons[name];
      if (/^https?:\/\//.test(c) || c.indexOf("/") === 0) return c;
      return base + "/" + encodeURIComponent(c);
    }
    return base + "/" + encodeURIComponent(traitStem(name)) + ".png";
  }

  function traitIconUrlResolved(name) {
    var u = traitIconUrl(name);
    if (/^https?:\/\//.test(u)) return u;
    var path = u.replace(/^\/+/, "");
    return assetUrlPath(path);
  }

  function traitThumbHtml(name, opts) {
    opts = opts || {};
    var loading = opts.loading === "eager" ? "eager" : "lazy";
    var decoding = opts.decoding === "sync" ? "sync" : "async";
    var url = traitIconUrlResolved(name);
    var glyph = String(name || "")
      .replace(/\*+$/g, "")
      .trim();
    return (
      '<span class="gadget-thumb">' +
      '<img class="gadget-thumb__img" src="' +
      escapeHtml(url) +
      '" alt="" loading="' +
      loading +
      '" decoding="' +
      decoding +
      '" onload="this.parentElement.classList.add(\'has-img\')" onerror="this.remove()" />' +
      '<span class="gadget-thumb__fallback" aria-hidden="true">' +
      escapeHtml(initialGlyph(glyph)) +
      "</span></span>"
    );
  }

  function relatedBrainrots(b, limit) {
    limit = limit || 8;
    var pool = BRAINROTS.filter(function (x) {
      return x.rarity === b.rarity && x.slug !== b.slug;
    });
    if (!pool.length) return [];
    var hasPopularity = false;
    var i;
    for (i = 0; i < pool.length; i++) {
      var p = pool[i].popularity;
      if (typeof p === "number" && p === p) {
        hasPopularity = true;
        break;
      }
    }
    var ordered;
    if (hasPopularity) {
      ordered = pool.slice().sort(function (a, b) {
        var pa = typeof a.popularity === "number" && a.popularity === a.popularity ? a.popularity : -1;
        var pb = typeof b.popularity === "number" && b.popularity === b.popularity ? b.popularity : -1;
        if (pb !== pa) return pb - pa;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    } else {
      ordered = shuffleArray(pool);
    }
    return ordered.slice(0, limit);
  }

  function brainrotRaritySectionId(rarity) {
    return (
      "brainrots-rarity-" +
      String(rarity || "unknown")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    );
  }

  function applyBrainrotRatingsPayload(j) {
    BRAINROT_RATINGS = {};
    if (!j || !j.ok || !j.aggregates || typeof j.aggregates !== "object") return;
    Object.keys(j.aggregates).forEach(function (slug) {
      var a = j.aggregates[slug];
      if (a && a.reactions && typeof a === "object" && typeof a.totalVotes === "number" && a.totalVotes > 0) {
        BRAINROT_RATINGS[slug] = {
          reactions: a.reactions,
          totalVotes: a.totalVotes,
          score: typeof a.score === "number" && a.score === a.score ? a.score : null,
        };
      }
    });
  }

  function brainrotTagsForUi(b) {
    if (!b || typeof b !== "object") return [];
    if (!Array.isArray(b.tags) || !b.tags.length) return [];
    return b.tags
      .map(function (t) {
        return t != null ? String(t).trim() : "";
      })
      .filter(function (t) {
        return t !== "";
      })
      .map(brainrotTagDisplayLabel)
      .filter(function (t) {
        return t !== "";
      });
  }

  function brainrotTagsHtmlForUi(b) {
    var tags = brainrotTagsForUi(b);
    if (!tags.length) return "";
    function tagClassName(tag) {
      return (
        "brainrot-tag--" +
        String(tag || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      );
    }
    return (
      '<div class="brainrot-card__tags">' +
      tags
        .map(function (tag) {
          return (
            '<span class="brainrot-tag ' +
            escapeAttr(tagClassName(tag)) +
            '">' +
            escapeHtml(String(tag)) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function appendBrainrotCardEl(parent, b) {
    var rc = rarityBadgeClass(b.rarity);
    var cr = findCarpetRateForBrainrot(b);
    var tagsHtml = brainrotTagsHtmlForUi(b);
    var carpetRow =
      cr !== null && cr !== undefined && String(cr).trim() !== ""
        ? "<li><span>Carpet</span> <strong>" + escapeHtml(String(cr)) + "%</strong></li>"
        : "";
    var a = document.createElement("a");
    a.className = "brainrot-card brainrot-card--link";
    a.setAttribute("data-spa-path", "/brainrots/" + encodeURIComponent(b.slug));
    a.href = spaHref("/brainrots/" + encodeURIComponent(b.slug));
    a.innerHTML =
      '<div class="brainrot-card__thumb brainrot-thumb" aria-hidden="true">' +
      brainrotThumbMediaHtml(b.name, b, "default") +
      "</div>" +
      '<div class="brainrot-card__body">' +
      '<h3 class="brainrot-card__name">' +
      escapeHtml(b.name) +
      "</h3>" +
      '<span class="brainrot-card__rarity ' +
      rc +
      '">' +
      escapeHtml(formatRarityLabel(b.rarity)) +
      "</span>" +
      tagsHtml +
      '<ul class="brainrot-stats">' +
      "<li><span>Base income</span> <strong>" +
      escapeHtml(formatIncomePerSec(b.incomePerSec)) +
      "</strong></li>" +
      "<li><span>Price</span> <strong>" +
      escapeHtml(formatMoney(b.price)) +
      "</strong></li>" +
      carpetRow +
      "</ul>" +
      "</div>";
    parent.appendChild(a);
  }

  function matchRarityKeyFromLabel(name) {
    var s = String(name).trim();
    var i;
    for (i = 0; i < RARITY_ORDER.length; i++) {
      var k = RARITY_ORDER[i];
      if (formatRarityLabel(k) === s) return k;
    }
    if (s === "BrainrotGod" || s === "Brainrot God") return "Brainrot God";
    return null;
  }

  var spawnRatesApi = window.STBGGSpawnRates.init({
    $: $,
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    translationTx: translationTx,
    luckyRateHtml: luckyRateHtml,
    formatMultiplier: formatMultiplier,
    formatRarityLabel: formatRarityLabel,
    canonicalRarityBucketKey: canonicalRarityBucketKey,
    matchRarityKeyFromLabel: matchRarityKeyFromLabel,
    getRarityOrder: function () {
      return RARITY_ORDER;
    },
    getBrainrots: function () {
      return BRAINROTS;
    },
    getTypesCatalog: function () {
      return BRAINROT_TYPES_CATALOG;
    },
    getCatalogTypeMultiplier: function (slug) {
      return getCatalogTypeMultiplier(slug);
    },
    getTypeSpawnEventTables: function () {
      return TYPE_SPAWN_EVENT_TABLES;
    },
    getRaritySpawnEnginePayload: function () {
      return RARITY_SPAWN_ENGINE_PAYLOAD;
    },
    getBrainrotSpawnTypePayload: function () {
      return BRAINROT_SPAWN_TYPE_PAYLOAD;
    },
  });

  var eventsApi =
    window.STBGGEvents &&
    window.STBGGEvents.init({
      escapeHtml: escapeHtml,
      escapeAttr: escapeAttr,
      translationTx: translationTx,
      publicAssetSrc: publicAssetSrc,
      siteApiUrl: siteApiUrl,
      getBootSchedule: function () {
        return REALTIME_EVENTS_SCHEDULE;
      },
      getCurrentRoute: function () {
        return parseRoute(getCurrentPath());
      },
    });

  function eventsDocumentTitle() {
    return translationTx("eventsPage.title", "Events") + " · " + BASE_TITLE;
  }

  function brainrotCatalogSectionOrder(mode) {
    return RARITY_ORDER.slice();
  }

  function renderBrainrots(list) {
    var catalog = $("#brainrot-catalog");
    var empty = $("#brainrot-empty");
    var load = $("#brainrot-load");
    if (!catalog) return;

    if (load) load.hidden = true;

    catalog.innerHTML = "";
    if (!list.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    var sortMode = getBrainrotSortMode();
    var sorted = sortBrainrotsForGrid(list.slice(), sortMode);
    if (sortMode !== "rarity") {
      var flatGrid = document.createElement("div");
      flatGrid.className = "brainrot-grid";
      sorted.forEach(function (b) {
        appendBrainrotCardEl(flatGrid, b);
      });
      catalog.appendChild(flatGrid);
      hydrateBrainrotAtlasProbes(catalog);
      return;
    }
    var buckets = {};
    RARITY_ORDER.forEach(function (r) {
      buckets[r] = [];
    });
    sorted.forEach(function (b) {
      var r = canonicalRarityBucketKey(b.rarity);
      if (!buckets[r]) buckets[r] = [];
      buckets[r].push(b);
    });

    function appendSectionForRarity(rarity, items) {
      if (!items || !items.length) return;
      var sec = document.createElement("section");
      sec.className = "brainrot-rarity-section brainrot-rarity-section--boxed";
      var rid = brainrotRaritySectionId(rarity);
      sec.setAttribute("aria-labelledby", rid);
      var h = document.createElement("h3");
      h.id = rid;
      h.className =
        "brainrot-rarity-heading " + rarityBadgeClass(rarity);
      h.textContent = formatRarityLabel(rarity);
      var gridEl = document.createElement("div");
      gridEl.className = "brainrot-grid";
      items.forEach(function (b) {
        appendBrainrotCardEl(gridEl, b);
      });
      sec.appendChild(h);
      sec.appendChild(gridEl);
      catalog.appendChild(sec);
    }

    var sectionOrder = brainrotCatalogSectionOrder(sortMode);
    var seenSection = {};
    sectionOrder.forEach(function (rarity) {
      seenSection[rarity] = true;
      appendSectionForRarity(rarity, buckets[rarity]);
    });
    Object.keys(buckets).forEach(function (rarity) {
      if (seenSection[rarity]) return;
      appendSectionForRarity(rarity, buckets[rarity]);
    });

    hydrateBrainrotAtlasProbes(catalog);
  }

  function brainrotMatchesSearch(b, lower) {
    if (!lower) return true;
    if (b.name.toLowerCase().indexOf(lower) !== -1) return true;
    if (/^\d+$/.test(lower) && String(b.id) === lower) return true;
    return false;
  }

  var BRAINROT_CATALOG_TAG_OPTIONS = [
    "Lucky Rot",
    "Grande Rot",
    "Pumpkin Rot",
    "Present Rot",
    "Love Rot",
    "Easter Rot",
    "Forest Rot",
    "Llama Rot",
    "BoxRot",
    "Carpet",
    "Eternal Machine",
    "Admin Machine",
    "Christmas Craft",
    "Ferinsini Luckini",
    "Ritual",
    "Limited Time",
    "Admin Spawn",
    "Rebirth",
  ];

  var BRAINROT_TAG_FILTER_GLYPH = {
    "lucky rot": "\u2739",
    "grande rot": "\u25c6",
    "pumpkin rot": "\u25cb",
    "present rot": "\u25a1",
    "love rot": "\u2665",
    "easter rot": "\u273f",
    "forest rot": "\u2663",
    "llama rot": "\u2197",
    boxrot: "\u25a3",
    carpet: "\u2588",
    "eternal machine": "\u221e",
    "admin machine": "\u2699",
    "christmas craft": "\u2736",
    "ferinsini luckini": "\u2738",
    ritual: "\u25d0",
    "limited time": "\u231b",
    "admin spawn": "\u29c9",
    rebirth: "\u21bb",
  };

  var BRAINROT_TAG_FILTER_ICON_REL = {
    "lucky rot": "assets/images/Tags/LuckyRot.jpg",
    "grande rot": "assets/images/Tags/Grande_Rot.png",
    "pumpkin rot": "assets/images/Tags/PumkinRot.jpg",
    "love rot": "assets/images/Tags/Love_Rot.png",
    "easter rot": "assets/images/Tags/Easter_Rot.png",
    "forest rot": "assets/images/Tags/Forest_Rot.png",
    "present rot": "assets/images/Tags/Present_Rot.png",
    "llama rot": "assets/images/Tags/Chocolate_Llama_Rot.png",
    "christmas craft": "assets/images/Tags/CraftSkip.png",
    "eternal machine": "assets/images/Tags/machineskip.png",
    "ferinsini luckini": "assets/images/Tags/FerinsiLuckini.jpg",
  };

  var brainrotTagFilterSelected = Object.create(null);
  var brainrotTagFilterEventsWired = false;

  function normBrainrotCatalogTagKey(label) {
    return String(label || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  var BRAINROT_TAG_DISPLAY_BY_KEY = Object.create(null);
  (function () {
    var i;
    for (i = 0; i < BRAINROT_CATALOG_TAG_OPTIONS.length; i++) {
      var lab = BRAINROT_CATALOG_TAG_OPTIONS[i];
      BRAINROT_TAG_DISPLAY_BY_KEY[normBrainrotCatalogTagKey(lab)] = lab;
    }
  })();

  function brainrotTagDisplayLabel(raw) {
    var s = raw != null ? String(raw).trim() : "";
    if (!s) return "";
    var k = normBrainrotCatalogTagKey(s);
    if (BRAINROT_TAG_DISPLAY_BY_KEY[k]) return BRAINROT_TAG_DISPLAY_BY_KEY[k];
    return s
      .split(/\s+/)
      .map(function (w) {
        if (!w) return "";
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  function brainrotTagFilterIconSrc(label) {
    var k = normBrainrotCatalogTagKey(label);
    var rel = BRAINROT_TAG_FILTER_ICON_REL[k];
    if (!rel) return "";
    var u = publicAssetSrc(rel);
    return u ? u.replace(/ /g, "%20") : "";
  }

  function brainrotTagFilterGlyphFor(label) {
    var k = normBrainrotCatalogTagKey(label);
    return BRAINROT_TAG_FILTER_GLYPH[k] || "\u2022";
  }

  function brainrotTagFilterActiveKeys() {
    return Object.keys(brainrotTagFilterSelected);
  }

  function brainrotMatchesTagFilters(b) {
    var keys = brainrotTagFilterActiveKeys();
    if (!keys.length) return true;
    var tags = brainrotTagsForUi(b);
    var set = Object.create(null);
    var i;
    for (i = 0; i < tags.length; i++) set[normBrainrotCatalogTagKey(tags[i])] = true;
    for (i = 0; i < keys.length; i++) {
      if (set[keys[i]]) return true;
    }
    return false;
  }

  function syncBrainrotTagFilterChipClasses() {
    var grid = $("#brainrot-tag-grid");
    if (!grid) return;
    var chips = grid.querySelectorAll(".brainrots-tag-chip");
    var i;
    for (i = 0; i < chips.length; i++) {
      var btn = chips[i];
      var k = btn.getAttribute("data-tag-key") || "";
      btn.classList.toggle("brainrots-tag-chip--active", !!brainrotTagFilterSelected[k]);
      btn.setAttribute("aria-pressed", brainrotTagFilterSelected[k] ? "true" : "false");
    }
  }

  function refreshBrainrotTagFilterTrigger() {
    var trig = $("#brainrot-tag-trigger");
    if (!trig) return;
    var n = brainrotTagFilterActiveKeys().length;
    trig.classList.toggle("brainrots-tag-filter__trigger--active", n > 0);
  }

  function setBrainrotTagPanelOpen(open) {
    var trig = $("#brainrot-tag-trigger");
    var panel = $("#brainrot-tag-panel");
    if (!trig || !panel) return;
    if (!open) {
      var ae = document.activeElement;
      if (ae && panel.contains(ae)) {
        trig.focus();
      }
    }
    trig.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    trig.classList.toggle("brainrots-tag-filter__trigger--open", open);
  }

  function refreshBrainrotsGridFromFilters() {
    var path = getPath();
    var route = parseRoute(path);
    if (route.view === "brainrots") renderBrainrots(getFilteredBrainrots());
  }

  function ensureBrainrotTagFilterUi() {
    var grid = $("#brainrot-tag-grid");
    var root = $("#brainrot-tag-filter-root");
    if (!grid || !root) return;
    if (!grid.dataset.stbTagFilterBuilt) {
      grid.innerHTML = "";
      BRAINROT_CATALOG_TAG_OPTIONS.forEach(function (label) {
        var key = normBrainrotCatalogTagKey(label);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "brainrots-tag-chip";
        btn.setAttribute("data-tag-key", key);
        btn.setAttribute("aria-pressed", "false");
        var skew = document.createElement("span");
        skew.className = "brainrots-tag-chip__skew";
        var inner = document.createElement("span");
        inner.className = "brainrots-tag-chip__inner";
        var glyph = document.createElement("span");
        glyph.className = "brainrots-tag-chip__glyph";
        glyph.setAttribute("aria-hidden", "true");
        var iconSrc = brainrotTagFilterIconSrc(label);
        if (iconSrc) {
          glyph.classList.add("brainrots-tag-chip__glyph--icon");
          var img = document.createElement("img");
          img.className = "brainrots-tag-chip__icon";
          img.alt = "";
          img.decoding = "async";
          img.loading = "lazy";
          img.src = iconSrc;
          glyph.appendChild(img);
        } else {
          glyph.textContent = brainrotTagFilterGlyphFor(label);
        }
        var tx = document.createElement("span");
        tx.className = "brainrots-tag-chip__text";
        tx.textContent = label;
        inner.appendChild(glyph);
        inner.appendChild(tx);
        skew.appendChild(inner);
        btn.appendChild(skew);
        btn.addEventListener("click", function () {
          if (brainrotTagFilterSelected[key]) delete brainrotTagFilterSelected[key];
          else brainrotTagFilterSelected[key] = true;
          syncBrainrotTagFilterChipClasses();
          refreshBrainrotTagFilterTrigger();
          refreshBrainrotsGridFromFilters();
        });
        grid.appendChild(btn);
      });
      grid.dataset.stbTagFilterBuilt = "1";
    }
    if (brainrotTagFilterEventsWired) return;
    brainrotTagFilterEventsWired = true;
    var trig = $("#brainrot-tag-trigger");
    var panel = $("#brainrot-tag-panel");
    var clearBtn = $("#brainrot-tag-clear");
    if (trig && panel) {
      trig.setAttribute(
        "aria-label",
        translationTx("brainrotsPage.tagFilterAria", "Open tag filter"),
      );
      panel.setAttribute(
        "aria-label",
        translationTx("brainrotsPage.tagFilterPanelAria", "Filter catalog by tags"),
      );
      trig.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = panel.hidden;
        setBrainrotTagPanelOpen(open);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        brainrotTagFilterSelected = Object.create(null);
        syncBrainrotTagFilterChipClasses();
        refreshBrainrotTagFilterTrigger();
        refreshBrainrotsGridFromFilters();
      });
    }
    document.addEventListener(
      "click",
      function (e) {
        var rootNow = $("#brainrot-tag-filter-root");
        var panelNow = $("#brainrot-tag-panel");
        if (!panelNow || panelNow.hidden || !rootNow) return;
        var node = e.target;
        while (node && node.nodeType !== 1) node = node.parentNode;
        if (!node || typeof node.closest !== "function") return;
        if (rootNow.contains(node)) return;
        setBrainrotTagPanelOpen(false);
      },
      true,
    );
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!panel || panel.hidden) return;
      setBrainrotTagPanelOpen(false);
    });
    syncBrainrotTagFilterChipClasses();
    refreshBrainrotTagFilterTrigger();
  }

  function getFilteredBrainrots() {
    var q = ($("#brainrot-search") && $("#brainrot-search").value) || "";
    var rarity = ($("#rarity-filter") && $("#rarity-filter").value) || "";
    var lower = q.trim().toLowerCase();
    return BRAINROTS.filter(function (b) {
      if (rarity && b.rarity !== rarity) return false;
      if (!brainrotMatchesSearch(b, lower)) return false;
      if (!brainrotMatchesTagFilters(b)) return false;
      return true;
    });
  }

  function fillRarityFilter() {
    var sel = $("#rarity-filter");
    if (!sel) return;
    var seen = {};
    BRAINROTS.forEach(function (b) {
      seen[b.rarity] = true;
    });
    var keys = Object.keys(seen);
    keys.sort(function (a, b) {
      return rarityOrderIndex(a) - rarityOrderIndex(b);
    });
    var current = sel.value;
    sel.innerHTML =
      '<option value="">' +
      escapeHtml(translationTx("brainrotsPage.filterAllRarities", "All rarities")) +
      "</option>";
    keys.forEach(function (key) {
      var o = document.createElement("option");
      o.value = key;
      o.textContent = formatRarityLabel(key);
      sel.appendChild(o);
    });
    if (keys.indexOf(current) !== -1) sel.value = current;
  }

  function formatMultiplier(m) {
    var n = parseTypeMultiplier(m);
    if (n == null) return String(m == null ? "" : m);
    if (!isFinite(n)) return "—";
    var s = n.toFixed(2).replace(/\.?0+$/, "");
    return s;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatDurationSeconds(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) {
      return h + ":" + pad2(m) + ":" + pad2(s);
    }
    return m + ":" + pad2(s);
  }

  function ensureAdminMachineTimer() {
    if (adminMachineTimerStarted) return;
    adminMachineTimerStarted = true;
    setInterval(tickAdminMachineLive, 1000);
  }

  var ADMIN_MACHINE_BRAINROT_CATALOG_NAME = {
    "Mcpene Dougal": "McPenne Dougal",
    "W Or L": "W or L",
    "Rang Rang Kelerang": "Rang Reng Kelerang",
  };

  function linkAdminMachineBrainrotHtml(displayName) {
    var n = String(displayName == null ? "" : displayName).trim();
    if (!n) return "—";
    var lookup = ADMIN_MACHINE_BRAINROT_CATALOG_NAME[n] || n;
    return linkBrainrotNameHtml(n, lookup);
  }

  function getDefaultAdminMachineIcons() {
    return {
      boostBase: "/assets/images/Boosters",
      boostByEnum: { "11": "boxrot.png", "7": "llamarot.png", "13": "eggrot.png", "1": "Luck.png" },
      luckByAmount: { "2x": "Luck.png", "4x": "Luck.png", "10x": "Luck.png" },
    };
  }

  function normalizeAdminMachineIconsPayload(j) {
    var d = getDefaultAdminMachineIcons();
    if (!j || typeof j !== "object") return d;
    return {
      boostBase: typeof j.boostBase === "string" ? j.boostBase : d.boostBase,
      boostByEnum:
        j.boostByEnum && typeof j.boostByEnum === "object" ? j.boostByEnum : d.boostByEnum,
      luckByAmount:
        j.luckByAmount && typeof j.luckByAmount === "object" ? j.luckByAmount : d.luckByAmount,
    };
  }

  function adminMachineBoostIconUrl(snap) {
    var ic = normalizeAdminMachineIconsPayload(ADMIN_MACHINE_ICONS_PAYLOAD);
    var base = String(ic.boostBase || "").replace(/\/$/, "");
    if (!base) return null;
    if (snap.boostEnum === 1 && snap.luckAmount && snap.luckAmount !== "None") {
      var luck = String(snap.luckAmount);
      var f = ic.luckByAmount[luck];
      if (!f) f = "Luck_" + luck + ".png";
      return assetUrlPath(base + "/" + f);
    }
    var file = ic.boostByEnum[String(snap.boostEnum)];
    if (file) return assetUrlPath(base + "/" + file);
    return null;
  }

  function adminMachineTraitSlotsHtml(traitNames) {
    if (!traitNames || !traitNames.length) {
      return (
        '<span class="admin-machine-live__trait-none">' +
        escapeHtml(translationTx("adminMachinePage.traitNone", "None")) +
        "</span>"
      );
    }
    return traitNames
      .map(function (t) {
        var url = traitIconUrlResolved(t);
        return (
          '<span class="admin-machine-live__icon-slot admin-machine-live__icon-slot--trait">' +
          '<img class="admin-machine-live__slot-img" src="' +
          escapeHtml(url) +
          '" alt="" decoding="async" onerror="this.parentElement.classList.add(\'no-img\');this.remove()" />' +
          '<span class="admin-machine-live__icon-slot-label">' +
          escapeHtml(String(t)) +
          "</span></span>"
        );
      })
      .join("");
  }

  function adminMachineBoostBlockHtml(snap) {
    var label = snap.boostName || "—";
    if (snap.boostEnum === 1 && snap.luckAmount && snap.luckAmount !== "None") {
      label = adminMachineBoostLuckLabel(snap.luckAmount);
    }
    var url = adminMachineBoostIconUrl(snap);
    var img = url
      ? '<img class="admin-machine-live__slot-img" src="' +
        escapeHtml(url) +
        '" alt="" decoding="async" onerror="this.parentElement.classList.add(\'no-img\');this.remove()" />'
      : "";
    return (
      '<span class="admin-machine-live__icon-slot admin-machine-live__icon-slot--boost">' +
      img +
      '<span class="admin-machine-live__icon-slot-label">' +
      escapeHtml(label) +
      "</span></span>"
    );
  }

  function adminMachineEventIconUrl(eventName) {
    var n = String(eventName == null ? "" : eventName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!n || n === "luckyrot") return null;
    var fileByEvent = {
      heaven: "Heaven_Event.png",
      void: "VOID_EVENT.png",
      love: "Love_Event.png",
      darkness: "Darkness_Event.png",
      toxic: "Toxic_Event.png",
      aqua: "Underwater_Event.png",
      crystal: "CRYSTAL_EVENT.png",
      tokyo: "Tokyo_Event.png",
      chocolate: "Chocolate_Event.png",
      icefire: "Ice___Fire_Event.png",
      questionmarks: "Questionmarks.png",
    };
    var file = fileByEvent[n];
    return file ? assetUrlPath("/assets/images/Events/" + file) : null;
  }

  function adminMachineEventBlockHtml(eventName) {
    var label = String(eventName == null ? "" : eventName).trim();
    var url = adminMachineEventIconUrl(label);
    var img = url
      ? '<img class="admin-machine-live__slot-img" src="' +
        escapeHtml(url) +
        '" alt="" decoding="async" onerror="this.parentElement.classList.add(\'no-img\');this.remove()" />'
      : "";
    return '<span class="admin-machine-live__event-media">' + img + "</span>";
  }

  function adminMachineBrainrotBlockHtml(characterName, spawnEtaMinutes) {
    var n = String(characterName == null ? "" : characterName).trim();
    if (!n) {
      return '<span class="admin-machine-live__trait-none">—</span>';
    }
    var lookup = ADMIN_MACHINE_BRAINROT_CATALOG_NAME[n] || n;
    var b = findBrainrotForLink(lookup);
    var thumb =
      '<span class="admin-machine-live__brainrot-thumb brainrot-thumb brainrot-thumb--admin-machine-live">' +
      brainrotThumbMediaHtml(n, b, "default", {}) +
      "</span>";
    var link = linkBrainrotNameHtml(n, lookup);
    var etaText =
      String(spawnEtaMinutes != null && spawnEtaMinutes !== "" ? spawnEtaMinutes : "—") +
      translationTx("adminMachinePage.spawnEtaMinutesSuffix", " min");
    return (
      '<div class="admin-machine-live__brainrot-pair">' +
      '<div class="admin-machine-live__brainrot-box admin-machine-live__brainrot-box--identity">' +
      thumb +
      '<span class="admin-machine-live__brainrot-name-wrap">' +
      link +
      "</span></div>" +
      '<div class="admin-machine-live__brainrot-box admin-machine-live__brainrot-box--spawn">' +
      '<span class="admin-machine-live__brainrot-spawn-label">' +
      escapeHtml(translationTx("adminMachinePage.spawnEtaApprox", "Spawn ETA (approx.)")) +
      "</span>" +
      '<span class="admin-machine-live__brainrot-spawn-value">' +
      escapeHtml(etaText) +
      "</span></div></div>"
    );
  }

  function adminMachinePreviewSerialize(p) {
    if (!p) return "";
    return [
      p.eventName || "",
      (p.traitNames || []).join("|"),
      p.boostEnum,
      p.luckAmount || "",
      p.characterName || "",
      String(p.spawnEtaMinutes != null ? p.spawnEtaMinutes : ""),
    ].join("\x1e");
  }

  function buildAdminMachineLiveInnerHtml(preview, cd) {
    var traitNames = preview.traitNames && preview.traitNames.length ? preview.traitNames : [];
    return (
      '<div class="admin-machine-live__inner">' +
      '<div class="admin-machine-live__top">' +
      '<span class="admin-machine-live__phase is-next">' +
      escapeHtml(translationTx("adminMachinePage.phaseUpcoming", "Upcoming rotation")) +
      "</span>" +
      '<p class="admin-machine-live__countdown">' +
      '<span class="admin-machine-live__cd-label">' +
      escapeHtml(cd.label) +
      ": </span><strong>" +
      escapeHtml(formatDurationSeconds(cd.seconds)) +
      "</strong></p>" +
      "</div>" +
      '<div class="admin-machine-live__body">' +
      '<div class="admin-machine-live__stat admin-machine-live__stat--event">' +
      '<span class="admin-machine-live__label">' +
      escapeHtml(translationTx("adminMachinePage.statEvent", "Event")) +
      "</span>" +
      '<div class="admin-machine-live__value admin-machine-live__value--event">' +
      adminMachineEventBlockHtml(preview.eventName) +
      "</div>" +
      "</div>" +
      '<div class="admin-machine-live__stat">' +
      '<span class="admin-machine-live__label">' +
      escapeHtml(translationTx("adminMachinePage.statBoost", "Boost")) +
      "</span>" +
      '<div class="admin-machine-live__value admin-machine-live__value--boost">' +
      adminMachineBoostBlockHtml(preview) +
      "</div>" +
      "</div>" +
      '<div class="admin-machine-live__stat admin-machine-live__stat--traits">' +
      '<span class="admin-machine-live__label">' +
      escapeHtml(translationTx("adminMachinePage.statTraits", "Traits")) +
      "</span>" +
      '<div class="admin-machine-live__trait-list">' +
      adminMachineTraitSlotsHtml(traitNames) +
      "</div>" +
      "</div>" +
      '<div class="admin-machine-live__stat admin-machine-live__stat--brainrot">' +
      '<span class="admin-machine-live__label">' +
      escapeHtml(translationTx("adminMachinePage.statBrainrot", "Brainrot")) +
      "</span>" +
      '<div class="admin-machine-live__value admin-machine-live__value--brainrot">' +
      adminMachineBrainrotBlockHtml(preview.characterName, preview.spawnEtaMinutes) +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function updateAdminMachineCountdownOnly(liveEl, cd) {
    var strong = liveEl.querySelector(".admin-machine-live__countdown strong");
    if (strong) {
      strong.textContent = formatDurationSeconds(cd.seconds);
    }
    var labelEl = liveEl.querySelector(".admin-machine-live__cd-label");
    if (labelEl && cd.label) {
      labelEl.textContent = cd.label + ": ";
    }
  }

  function tickAdminMachineLive() {
    var view = $("#view-admin-machine");
    var liveEl = $("#admin-machine-live");
    if (!view || view.hidden || !liveEl) return;

    if (ADMIN_MACHINE_API_MODE) {
      var previewApi = ADMIN_MACHINE_PREVIEW;
      if (!previewApi || !ADMIN_MACHINE_PREVIEW_BOUNDARY_UNIX) {
        liveEl.innerHTML =
          '<p class="loading-state">' +
          escapeHtml(translationTx("adminMachinePage.loadingShort", "Loading…")) +
          "</p>";
        return;
      }
      var nowSecApi = Math.floor(Date.now() / 1000) + ADMIN_MACHINE_SERVER_OFFSET_SEC;
      var cdApi = {
        label: adminMachineCountdownLabelForDisplay(ADMIN_MACHINE_COUNTDOWN_LABEL),
        seconds: Math.max(0, ADMIN_MACHINE_PREVIEW_BOUNDARY_UNIX - nowSecApi),
      };
      if (cdApi.seconds <= 0 && !adminMachineRefetchInFlight) {
        adminMachineRefetchInFlight = true;
        loadAdminMachineData().finally(function () {
          adminMachineRefetchInFlight = false;
        });
      }
      var keyApi = adminMachinePreviewSerialize(previewApi);
      if (keyApi !== adminMachinePreviewKey) {
        adminMachinePreviewKey = keyApi;
        liveEl.innerHTML = buildAdminMachineLiveInnerHtml(previewApi, cdApi);
        hydrateBrainrotAtlasProbes(liveEl);
        return;
      }
      updateAdminMachineCountdownOnly(liveEl, cdApi);
      return;
    }

    liveEl.innerHTML =
      '<p class="loading-state">' +
      translationTx(
        "adminMachinePage.livePreviewStaticNote",
        "Live preview requires <code>/api/admin-machine</code> (e.g. npm start or Cloudflare Pages with Functions). Reference tables below still load from static data.",
      ) +
      "</p>";
  }

  function renderAdminMachineReferenceOnce() {
    var introEl = $("#admin-machine-intro");
    var updatedEl = $("#admin-machine-page-updated");
    var sheet = $("#admin-machine-sheet");
    if (!ADMIN_MACHINE_REF || !sheet) return;
    var meta = ADMIN_MACHINE_REF.meta || {};

    if (updatedEl) {
      if (meta.lastUpdated == null || String(meta.lastUpdated).trim() === "") {
        updatedEl.hidden = true;
        updatedEl.innerHTML = "";
      } else {
        var rawUpdated = String(meta.lastUpdated).trim();
        var attrUpdated =
          meta.lastUpdatedIso != null && String(meta.lastUpdatedIso).trim() !== ""
            ? String(meta.lastUpdatedIso).trim()
            : rawUpdated;
        updatedEl.className = "page-last-updated";
        updatedEl.innerHTML =
          '<span class="page-last-updated__label">' +
          escapeHtml(translationTx("brainrotsPage.lastUpdatedLabel", "Last updated: ")) +
          "</span>" +
          '<time class="page-last-updated__date" datetime="' +
          escapeHtml(attrUpdated) +
          '">' +
          escapeHtml(formatLastUpdatedDisplay(rawUpdated)) +
          "</time>";
        updatedEl.hidden = false;
      }
    }

    if (introEl) {
      var invite = meta.discordInvite || "https://discord.gg/stb";
      var introText = translationTx("adminMachinePage.intro", meta.intro || "");
      var discordIconSvg =
        '<svg class="header-discord__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -28.5 256 256" width="22" height="22" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" fill-rule="nonzero" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"/>' +
        "</svg>";
      introEl.innerHTML =
        '<span class="admin-machine-intro__line">' +
        '<span class="admin-machine-intro__text">' +
        escapeHtml(introText) +
        "</span>" +
        '<a href="' +
        escapeAttr(String(invite)) +
        '" class="header-discord admin-machine-intro__discord" rel="noopener noreferrer" target="_blank" aria-label="' +
        escapeAttr(translationTx("header.discordAria", "STB-Arab on Discord")) +
        '">' +
        discordIconSvg +
        "</a>" +
        "</span>";
    }

    function rateRow(name, rate) {
      return (
        '<tr><td class="lucky-name">' +
        escapeHtml(name) +
        '</td><td class="lucky-rate-cell">' +
        luckyRateHtml(rate) +
        "</td></tr>"
      );
    }

    function rateRowBrainrot(r) {
      return (
        '<tr><td class="lucky-name">' +
        linkAdminMachineBrainrotHtml(r.name) +
        '</td><td class="lucky-rate-cell">' +
        luckyRateHtml(r.rate) +
        "</td></tr>"
      );
    }

    function rateRowTraitCount(r) {
      return (
        '<tr><td class="lucky-name">' +
        escapeHtml(String(r.count)) +
        '</td><td class="lucky-rate-cell">' +
        luckyRateHtml(r.rate) +
        "</td></tr>"
      );
    }

    function luckyColPanel(title, rarityClass, colA, colB, rows, rowFn) {
      var head =
        '<thead><tr><th scope="col">' +
        escapeHtml(colA) +
        '</th><th scope="col" class="lucky-th-rate">' +
        escapeHtml(colB) +
        "</th></tr></thead>";
      var body =
        "<tbody>" +
        rows
          .map(function (row) {
            return rowFn(row);
          })
          .join("") +
        "</tbody>";
      return (
        '<div class="lucky-col lucky-col--panel">' +
        '<div class="lucky-col__top">' +
        '<h3 class="lucky-col__head ' +
        rarityClass +
        '"><span class="lucky-col__head-text">' +
        escapeHtml(title) +
        "</span></h3></div>" +
        '<div class="lucky-table-wrap lucky-table-wrap--panel">' +
        '<table class="lucky-table">' +
        head +
        body +
        "</table></div></div>"
      );
    }

    var brainrots = ADMIN_MACHINE_REF.brainrots || [];
    var events = ADMIN_MACHINE_REF.events || [];
    var boosts = ADMIN_MACHINE_REF.boosts || [];
    var traitCounts = ADMIN_MACHINE_REF.traitCounts || [];
    var traits = ADMIN_MACHINE_REF.traits || [];

    var thRateRef = translationTx("adminMachinePage.thRate", "Rate");
    sheet.innerHTML =
      '<section class="lucky-section lucky-section--panel admin-machine-ref">' +
      '<div class="lucky-triple-grid">' +
      luckyColPanel(
        translationTx("adminMachinePage.referencePossibleBrainrots", "Possible Brainrots"),
        "rarity-mythic",
        translationTx("adminMachinePage.thBrainrotName", "Brainrot name"),
        thRateRef,
        brainrots,
        function (r) {
          return rateRowBrainrot(r);
        }
      ) +
      luckyColPanel(
        translationTx("adminMachinePage.referencePossibleEvents", "Possible Events"),
        "rarity-legendary",
        translationTx("adminMachinePage.thEventName", "Event name"),
        thRateRef,
        events,
        function (r) {
          return rateRow(r.name, r.rate);
        }
      ) +
      luckyColPanel(
        translationTx("adminMachinePage.referencePossibleBoosts", "Possible Boosts"),
        "rarity-epic",
        translationTx("adminMachinePage.thBoost", "Boost"),
        thRateRef,
        boosts,
        function (r) {
          return rateRow(r.name, r.rate);
        }
      ) +
      luckyColPanel(
        translationTx("adminMachinePage.referenceTraitCounts", "Trait counts"),
        "rarity-mythic",
        translationTx("adminMachinePage.thTraitCount", "Trait count"),
        thRateRef,
        traitCounts,
        function (r) {
          return rateRowTraitCount(r);
        }
      ) +
      luckyColPanel(
        translationTx("adminMachinePage.referenceTraitsList", "Traits"),
        "rarity-legendary",
        translationTx("adminMachinePage.thTraitsLabel", "Traits"),
        thRateRef,
        traits,
        function (r) {
          return rateRow(r.name, r.rate);
        }
      ) +
      "</div></section>";
  }

  function renderAdminMachinePanel() {
    adminMachinePreviewKey = "";
    renderAdminMachineReferenceOnce();
    tickAdminMachineLive();
  }

  function normalizeBoxRotRateRow(row) {
    if (!row || typeof row !== "object") return null;
    var name = row.name != null ? String(row.name).trim() : "";
    var rate = typeof row.rate === "number" ? row.rate : parseFloat(row.rate);
    if (!name || !(rate >= 0) || rate !== rate) return null;
    return { name: name, rate: rate };
  }

  function normalizeBoxRotLevelRow(row) {
    if (!row || typeof row !== "object") return null;
    var level = typeof row.level === "number" ? row.level : parseInt(row.level, 10);
    var hp = typeof row.hp === "number" ? row.hp : parseFloat(row.hp);
    var size = typeof row.size === "number" ? row.size : parseFloat(row.size);
    if (!(level > 0) || level !== level || !(hp > 0) || hp !== hp || !(size > 0) || size !== size) {
      return null;
    }
    var boxType = row.boxType != null ? String(row.boxType).trim() : "";
    return {
      level: level,
      boxType: boxType,
      hp: hp,
      size: size,
      rates: Array.isArray(row.rates) ? row.rates.map(normalizeBoxRotRateRow).filter(Boolean) : [],
    };
  }

  function normalizeBoxRotRateCell(v) {
    if (v == null || v === "") return null;
    var n = typeof v === "number" ? v : parseFloat(v);
    return n === n ? n : null;
  }

  function normalizeBoxRotSpawnRates(row) {
    if (!row || typeof row !== "object") return null;
    var rebirth = row.rebirth != null ? String(row.rebirth).trim() : "";
    if (!rebirth) return null;
    var rates = Array.isArray(row.rates) ? row.rates.map(normalizeBoxRotRateCell) : [];
    return { rebirth: rebirth, rates: rates };
  }

  function normalizeBoxRotTypeRates(row) {
    if (!row || typeof row !== "object") return null;
    var event = row.event != null ? String(row.event).trim() : "";
    if (!event) return null;
    var rates = Array.isArray(row.rates) ? row.rates.map(normalizeBoxRotRateCell) : [];
    return { event: event, rates: rates };
  }

  function boxRotTypeByLevel(level) {
    if (level === 1) return "Mythic BoxRot";
    if (level === 2) return "Brainrot God BoxRot";
    if (level >= 3 && level <= 6) return "Secret BoxRot";
    if (level === 7) return "Grande Secret BoxRot";
    return "";
  }

  function boxRotTypeRarityClass(boxType) {
    var t = String(boxType || "").toLowerCase();
    if (!t) return "rarity-mythic";
    if (t.indexOf("brainrot god") >= 0) return "rarity-brainrot-god";
    if (t.indexOf("grande secret") >= 0) return "rarity-grande-secret";
    if (t.indexOf("secret") >= 0) return "rarity-secret";
    if (t.indexOf("mythic") >= 0) return "rarity-mythic";
    return "rarity-mythic";
  }

  function boxRotsPageTitle() {
    var p = BOX_ROTS_PAYLOAD;
    if (p && p.meta && typeof p.meta.title === "string" && String(p.meta.title).trim() !== "") {
      return String(p.meta.title).trim();
    }
    return "Box Rot Rates";
  }

  function normalizeWheelRateRow(row) {
    if (!row || typeof row !== "object") return null;
    var name = row.name != null ? String(row.name).trim() : "";
    var rate = typeof row.rate === "number" ? row.rate : parseFloat(row.rate);
    if (!name || !(rate >= 0) || rate !== rate) return null;
    var slugHint =
      row.slug != null && String(row.slug).trim() !== "" ? String(row.slug).trim() : "";
    var segRaw = row.segment != null ? row.segment : row.segmentIndex;
    var segment = null;
    if (typeof segRaw === "number" && segRaw === segRaw && segRaw >= 0) {
      segment = Math.floor(segRaw);
    } else if (segRaw != null && String(segRaw).trim() !== "") {
      var sp = parseInt(String(segRaw).trim(), 10);
      if (sp === sp && sp >= 0) segment = sp;
    }
    return { name: name, rate: rate, slug: slugHint, segment: segment };
  }

  function normalizeWheelPayload(j) {
    if (!j || typeof j !== "object") j = {};
    var meta = j.meta && typeof j.meta === "object" ? j.meta : {};
    var img = j.image != null ? String(j.image).trim() : "";
    var ptr = j.pointer != null ? String(j.pointer).trim() : "";
    var spinRaw = j.spinOffsetDeg;
    var spinOffsetDeg =
      typeof spinRaw === "number" && spinRaw === spinRaw
        ? spinRaw
        : typeof spinRaw === "string" && String(spinRaw).trim() !== ""
          ? parseFloat(String(spinRaw).trim())
          : 0;
    if (!(spinOffsetDeg === spinOffsetDeg)) spinOffsetDeg = 0;
    var wsRaw = j.wheelSegments;
    var wheelSegments =
      typeof wsRaw === "number" && wsRaw === wsRaw && wsRaw > 0
        ? Math.floor(wsRaw)
        : typeof wsRaw === "string" && String(wsRaw).trim() !== ""
          ? parseInt(String(wsRaw).trim(), 10)
          : 0;
    if (!(wheelSegments === wheelSegments) || wheelSegments < 1) wheelSegments = 0;
    return {
      meta: {
        title: typeof meta.title === "string" ? meta.title : "Wheel Rates",
        lastUpdated: typeof meta.lastUpdated === "string" ? meta.lastUpdated : "",
      },
      image: img,
      pointer: ptr,
      spinOffsetDeg: spinOffsetDeg,
      wheelSegments: wheelSegments,
      rates: Array.isArray(j.rates) ? j.rates.map(normalizeWheelRateRow).filter(Boolean) : [],
    };
  }

  function wheelPageTitle() {
    var p = WHEEL_PAYLOAD;
    if (p && p.meta && typeof p.meta.title === "string" && String(p.meta.title).trim() !== "") {
      return String(p.meta.title).trim();
    }
    return translationTx("wheelPage.fallbackTitle", "Wheel Rates");
  }

  function luckyRotsPageTitle() {
    var p = LUCKY_ROTS_PAYLOAD;
    var raw =
      p && p.meta && typeof p.meta.title === "string" && String(p.meta.title).trim() !== ""
        ? String(p.meta.title).trim()
        : "Lucky Rot Rates";
    return titleCaseWords(raw);
  }

  function llamaRotsPageTitle() {
    var p = LLAMA_ROTS_PAYLOAD;
    var raw =
      p && p.meta && typeof p.meta.title === "string" && String(p.meta.title).trim() !== ""
        ? String(p.meta.title).trim()
        : "Llama Rot Rates";
    return titleCaseWords(raw);
  }

  function normalizeBoxRotsPayload(j) {
    if (!j || typeof j !== "object") j = {};
    var meta = j.meta && typeof j.meta === "object" ? j.meta : {};
    return {
      meta: {
        title: typeof meta.title === "string" ? meta.title : "Box Rot Rates",
        lastUpdated: typeof meta.lastUpdated === "string" ? meta.lastUpdated : "",
      },
      levels: Array.isArray(j.levels) ? j.levels.map(normalizeBoxRotLevelRow).filter(Boolean) : [],
      spawnRates:
        j.spawnRates && typeof j.spawnRates === "object"
          ? {
              title:
                typeof j.spawnRates.title === "string" ? j.spawnRates.title : "Box Rot Spawn Rates",
              note: typeof j.spawnRates.note === "string" ? j.spawnRates.note : "",
              extraNote: typeof j.spawnRates.extraNote === "string" ? j.spawnRates.extraNote : "",
              columns: Array.isArray(j.spawnRates.columns)
                ? j.spawnRates.columns.map(function (c) {
                    return String(c);
                  })
                : [],
              rows: Array.isArray(j.spawnRates.rows)
                ? j.spawnRates.rows.map(normalizeBoxRotSpawnRates).filter(Boolean)
                : [],
            }
          : null,
      typeRates:
        j.typeRates && typeof j.typeRates === "object"
          ? {
              title: typeof j.typeRates.title === "string" ? j.typeRates.title : "Box Rot Type Rates",
              columns: Array.isArray(j.typeRates.columns)
                ? j.typeRates.columns.map(function (c) {
                    return String(c);
                  })
                : [],
              rows: Array.isArray(j.typeRates.rows)
                ? j.typeRates.rows.map(normalizeBoxRotTypeRates).filter(Boolean)
                : [],
            }
          : null,
    };
  }

  function renderBoxRots() {
    var root = $("#boxrots-root");
    if (!root) return;
    var payload = BOX_ROTS_PAYLOAD;
    if (!payload || !payload.levels || !payload.levels.length) {
      root.innerHTML =
        '<div class="boxrots-inner"><p class="empty-state">No box rot rates configured yet. Add <code>data/boxrots.json</code>.</p></div>';
      return;
    }
    var cards = [];
    for (var i = 0; i < payload.levels.length; i++) {
      var lv = payload.levels[i];
      var boxType = lv.boxType || boxRotTypeByLevel(lv.level);
      var rarityClass = boxRotTypeRarityClass(boxType);
      var rows = "";
      var j;
      for (j = 0; j < lv.rates.length; j++) {
        var r = lv.rates[j];
        rows +=
          '<tr><td class="lucky-name">' +
          linkBrainrotNameHtml(r.name) +
          '</td><td class="lucky-rate-cell boxrots-rate-cell">' +
          escapeHtml(String(r.rate)) +
          "</td></tr>";
      }
      if (!rows) rows = '<tr><td colspan="2" class="boxrots-empty-cell">No rates</td></tr>';
      cards.push(
        '<article class="lucky-col lucky-col--panel boxrots-level">' +
          '<div class="lucky-col__top">' +
          '<h3 class="lucky-col__head ' +
          escapeAttr(rarityClass) +
          '">' +
          '<span class="lucky-col__head-text">Box Level ' +
          escapeHtml(String(lv.level)) +
          "</span></h3></div>" +
          '<p class="boxrots-level__meta lucky-table-note">' +
          (boxType ? escapeHtml(boxType) + " · " : "") +
          escapeHtml(String(lv.hp)) +
          " HP, Size " +
          escapeHtml(String(lv.size)) +
          "</p>" +
          '<div class="lucky-table-wrap lucky-table-wrap--panel boxrots-level__table-wrap"><table class="lucky-table boxrots-table"><thead><tr><th>Brainrot Name</th><th class="lucky-th-rate">Rate (%)</th></tr></thead><tbody>' +
          rows +
          "</tbody></table></div></article>"
      );
    }
    var spawnHtml = "";
    var sp = payload.spawnRates;
    if (sp && sp.columns && sp.columns.length && sp.rows && sp.rows.length) {
      var spHead =
        "<tr><th>Rebirth</th>" +
        sp.columns
          .map(function (c) {
            return "<th>" + escapeHtml(String(c)) + "</th>";
          })
          .join("") +
        "</tr>";
      var spBody = sp.rows
        .map(function (row) {
          var cells = sp.columns
            .map(function (_, idx) {
              var v = row.rates[idx];
              return "<td>" + (v == null ? "" : escapeHtml(String(v))) + "</td>";
            })
            .join("");
          return "<tr><td>" + escapeHtml(row.rebirth) + "</td>" + cells + "</tr>";
        })
        .join("");
      spawnHtml =
        '<section class="lucky-section lucky-section--panel boxrots-extra">' +
        '<div class="lucky-section__header">' +
        '<h2 class="lucky-section__title"><span class="lucky-section__title-text">' +
        escapeHtml(sp.title) +
        "</span></h2>" +
        (sp.note ? '<p class="lucky-section__intro boxrots-extra__note">' + escapeHtml(sp.note) + "</p>" : "") +
        (sp.extraNote
          ? '<p class="lucky-section__intro boxrots-extra__note">' + escapeHtml(sp.extraNote) + "</p>"
          : "") +
        "</div>" +
        '<div class="lucky-table-wrap lucky-table-wrap--panel boxrots-extra__table-wrap">' +
        '<table class="lucky-table boxrots-extra__table"><thead>' +
        spHead +
        "</thead><tbody>" +
        spBody +
        "</tbody></table></div></section>";
    }
    var typeHtml = "";
    var tp = payload.typeRates;
    if (tp && tp.columns && tp.columns.length && tp.rows && tp.rows.length) {
      var tpHead =
        "<tr><th>Type</th>" +
        tp.columns
          .map(function (c) {
            return "<th>" + escapeHtml(String(c)) + "</th>";
          })
          .join("") +
        "</tr>";
      var tpBody = tp.rows
        .map(function (row) {
          var cells = tp.columns
            .map(function (_, idx) {
              var v = row.rates[idx];
              return "<td>" + (v == null ? "" : escapeHtml(String(v))) + "</td>";
            })
            .join("");
          return "<tr><td>" + escapeHtml(row.event) + "</td>" + cells + "</tr>";
        })
        .join("");
      typeHtml =
        '<section class="lucky-section lucky-section--panel boxrots-extra">' +
        '<div class="lucky-section__header">' +
        '<h2 class="lucky-section__title"><span class="lucky-section__title-text">' +
        escapeHtml(tp.title) +
        "</span></h2>" +
        "</div>" +
        '<div class="lucky-table-wrap lucky-table-wrap--panel boxrots-extra__table-wrap">' +
        '<table class="lucky-table boxrots-extra__table"><thead>' +
        tpHead +
        "</thead><tbody>" +
        tpBody +
        "</tbody></table></div></section>";
    }
    root.innerHTML =
      '<div class="boxrots-inner">' +
      '<div class="traits-hero rebirth-hero boxrots-hero">' +
      "<h1>" +
      escapeHtml(payload.meta.title) +
      "</h1>" +
      (payload.meta.lastUpdated ? lastUpdatedParagraphHtml(payload.meta.lastUpdated, payload.meta.lastUpdated) : "") +
      "</div>" +
      '<section class="lucky-section lucky-section--panel boxrots-main">' +
      '<div class="boxrots-grid">' +
      cards.join("") +
      "</div></section>" +
      spawnHtml +
      typeHtml +
      "</div>";
  }

  function renderWheel() {
    var root = $("#wheel-root");
    if (!root) return;
    var payload = WHEEL_PAYLOAD;
    if (!payload || !payload.rates || !payload.rates.length) {
      root.innerHTML =
        '<div class="boxrots-inner"><p class="empty-state">' +
        escapeHtml(translationTx("wheelPage.empty", "No wheel data. Add data/wheel.json.")) +
        "</p></div>";
      return;
    }
    var rows = "";
    var i;
    for (i = 0; i < payload.rates.length; i++) {
      var r = payload.rates[i];
      var linkKey = r.slug ? r.slug : r.name;
      var nameCellHtml = findBrainrotForLink(linkKey)
        ? linkBrainrotNameHtml(r.name, linkKey)
        : escapeHtml(r.name);
      rows +=
        '<tr><td class="lucky-name">' +
        nameCellHtml +
        '</td><td class="lucky-rate-cell boxrots-rate-cell">' +
        escapeHtml(String(r.rate)) +
        "</td></tr>";
    }
    var imgBlock = "";
    if (payload.image) {
      var src = publicAssetSrc(payload.image);
      var alt = translationTx("wheelPage.imageAlt", "Prize wheel diagram");
      imgBlock =
        '<div class="wheel-visual">' +
        '<div class="wheel-visual__frame">' +
        '<img class="wheel-visual__img" src="' +
        escapeAttr(src) +
        '" alt="' +
        escapeAttr(alt) +
        '" loading="lazy" decoding="async" onerror="this.classList.add(\'is-broken\')" />' +
        "</div>" +
        "</div>";
    }
    var wheelCol = imgBlock ? '<div class="wheel-col">' + imgBlock + "</div>" : "";
    var layoutMod = wheelCol ? " wheel-layout--with-visual" : " wheel-layout--rates-only";
    root.innerHTML =
      '<div class="boxrots-inner">' +
      '<div class="traits-hero rebirth-hero boxrots-hero">' +
      "<h1>" +
      escapeHtml(payload.meta.title) +
      "</h1>" +
      (payload.meta.lastUpdated
        ? lastUpdatedParagraphHtml(payload.meta.lastUpdated, payload.meta.lastUpdated)
        : "") +
      "</div>" +
      '<div class="wheel-layout' +
      layoutMod +
      '">' +
      wheelCol +
      '<section class="lucky-section lucky-section--panel wheel-rates-section">' +
      '<div class="lucky-table-wrap lucky-table-wrap--panel wheel-rates__table-wrap">' +
      '<table class="lucky-table boxrots-table wheel-rates__table"><thead><tr><th>' +
      escapeHtml(translationTx("wheelPage.thReward", "Reward")) +
      '</th><th class="lucky-th-rate">' +
      escapeHtml(translationTx("wheelPage.thChance", "Chance (%)")) +
      "</th></tr></thead><tbody>" +
      rows +
      "</tbody></table></div></section></div>" +
      "</div>";
  }

  function renderStats() {
    var byRarity = $("#stats-by-rarity");
    var totals = $("#stats-totals");
    if (!byRarity || !totals) return;

    var counts = {};
    BRAINROTS.forEach(function (b) {
      var k = formatRarityLabel(b.rarity);
      counts[k] = (counts[k] || 0) + 1;
    });
    byRarity.innerHTML = "";
    RARITY_ORDER.forEach(function (r) {
      var lbl = formatRarityLabel(r);
      if (!counts[lbl]) return;
      var li = document.createElement("li");
      li.innerHTML =
        "<span>" + escapeHtml(lbl) + "</span> <span>" + counts[lbl] + "</span>";
      byRarity.appendChild(li);
    });

    var sumIncome = BRAINROTS.reduce(function (a, b) {
      return a + b.incomePerSec;
    }, 0);
    totals.innerHTML = "";
    function addRow(label, value) {
      var div = document.createElement("div");
      div.innerHTML = "<dt>" + escapeHtml(label) + "</dt><dd>" + value + "</dd>";
      totals.appendChild(div);
    }
    addRow(translationTx("statsPage.labelCatalogCount", "Brainrots in catalog"), String(BRAINROTS.length));

    var traitRows = (TRAITS_PAYLOAD && TRAITS_PAYLOAD.rows) || [];
    addRow(translationTx("statsPage.labelTraitsRef", "Traits"), String(traitRows.length));

    var mutN =
      BRAINROT_TYPES_CATALOG && Array.isArray(BRAINROT_TYPES_CATALOG.types)
        ? BRAINROT_TYPES_CATALOG.types.length
        : 0;
    addRow(translationTx("statsPage.labelMutationTypes", "Mutation types"), String(mutN));

    var rebirthLevels = (REBIRTHS_PAYLOAD && REBIRTHS_PAYLOAD.levels) || [];
    var maxRebirthLv = 0;
    rebirthLevels.forEach(function (row) {
      if (typeof row.level === "number" && row.level === row.level) {
        maxRebirthLv = Math.max(maxRebirthLv, row.level);
      }
    });
    if (rebirthLevels.length) {
      addRow(translationTx("statsPage.labelHighestRebirth", "Highest rebirth level"), String(maxRebirthLv));
    }

    addRow(
      translationTx("statsPage.labelCombinedIncome", "Combined base income / sec"),
      escapeHtml(formatIncomePerSec(sumIncome)),
    );
  }

  function renderTypeMultsPage() {
    var root = $("#type-mults-root");
    if (!root) return;

    if (!TYPE_MULTS_PAYLOAD || !Array.isArray(TYPE_MULTS_PAYLOAD.types) || !TYPE_MULTS_PAYLOAD.types.length) {
      root.innerHTML =
        '<div class="traits-inner"><p class="empty-state">No type multiplier data. Check that <code>data/type_mults.json</code> is reachable.</p></div>';
      return;
    }

    var meta = TYPE_MULTS_PAYLOAD.meta && typeof TYPE_MULTS_PAYLOAD.meta === "object" ? TYPE_MULTS_PAYLOAD.meta : {};
    var label = TYPE_MULTS_PAYLOAD.label || "Type multipliers";
    var updated =
      meta.lastUpdated != null && String(meta.lastUpdated).trim() !== ""
        ? lastUpdatedParagraphHtml(String(meta.lastUpdated).trim(), String(meta.lastUpdated).trim())
        : "";
    var src = TYPE_MULTS_PAYLOAD.source || "";
    var srcHtml = src
      ? '<p class="stats-source">' + escapeHtml("Source: " + src) + "</p>"
      : "";

    var lis = sortTypeRowsByMultiplierAsc(TYPE_MULTS_PAYLOAD.types)
      .map(function (t) {
        return (
          "<li><span>" +
          escapeHtml(t.name) +
          '</span> <span class="type-mults-mult">' +
          escapeHtml(formatMultiplier(t.multiplier)) +
          "×</span></li>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="traits-inner">' +
      '<div class="traits-hero rebirth-hero">' +
      "<h1>" +
      escapeHtml(label) +
      "</h1>" +
      updated +
      srcHtml +
      "</div>" +
      '<div class="stat-block stat-block--wide type-mults-block">' +
      '<ul class="stat-list stat-list--types" id="type-mults-list">' +
      lis +
      "</ul></div></div>";
  }

  function renderRebirth() {
    var root = $("#rebirth-root");
    if (!root) return;

    var payload = REBIRTHS_PAYLOAD || { meta: {}, levels: [] };
    var meta = payload.meta || {};
    var levels = payload.levels || [];

    if (!levels.length) {
      root.innerHTML =
        '<div class="rebirth-inner"><p class="empty-state">' +
        escapeHtml(translationTx("rebirthPage.emptyData", "No rebirth data. Check that data/rebirths.json is reachable (same folder as this site, or under your app path if hosted in a subfolder).")) +
        "</p></div>";
      return;
    }

    /** Brainrot links need BRAINROTS from data/brainrots.json; rebirths often load first. */
    if (!catalogReady) {
      root.innerHTML =
        '<div class="rebirth-inner"><p class="loading-state">' +
        escapeHtml(translationTx("rebirthPage.loadingCatalog", "Loading catalog…")) +
        "</p></div>";
      return;
    }

    try {
    var title = translationTx("rebirthPage.defaultTitle", meta.title || "Rebirth levels");
    var updated = meta.lastUpdated
      ? lastUpdatedParagraphHtml(meta.lastUpdated, meta.lastUpdated)
      : "";

    var thead =
      "<thead>" +
      "<tr>" +
      '<th rowspan="2" scope="col" class="rebirth-col-level">' +
      escapeHtml(translationTx("rebirthPage.thLvl", "Lvl")) +
      "</th>" +
      '<th colspan="2" scope="colgroup" class="rebirth-th-group rebirth-th-group--req">' +
      escapeHtml(translationTx("rebirthPage.thRequirementsGroup", "Requirements")) +
      "</th>" +
      '<th colspan="5" scope="colgroup" class="rebirth-th-group rebirth-th-group--rew">' +
      escapeHtml(translationTx("rebirthPage.thRewardsGroup", "Rewards")) +
      "</th>" +
      "</tr>" +
      "<tr>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thMoney", "Money")) +
      "</th>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thBrainrots", "Brainrots")) +
      "</th>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thInitial", "Initial $")) +
      "</th>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thMoneyMult", "$ mult")) +
      "</th>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thLock", "Lock")) +
      "</th>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thSlots", "Slots")) +
      "</th>" +
      '<th scope="col">' +
      escapeHtml(translationTx("rebirthPage.thGadgets", "Gadgets")) +
      "</th>" +
      "</tr>" +
      "</thead>";

    var tbody = levels
      .map(function (row) {
        var br = rebirthBrainrotsListHtml(row.brainrots || []);
        var gadgets = gadgetChipsHtml(row.gadgets || []);
        return (
          "<tr>" +
          '<th scope="row" class="rebirth-col-level">' +
          escapeHtml(String(row.level)) +
          "</th>" +
          "<td>" +
          rebirthCell(row.money) +
          "</td>" +
          "<td class=\"rebirth-cell-brainrots\">" +
          br +
          "</td>" +
          "<td>" +
          rebirthCell(row.initialBalance) +
          "</td>" +
          "<td>" +
          rebirthCell(row.moneyMult) +
          "</td>" +
          "<td>" +
          rebirthCell(row.lockTime) +
          "</td>" +
          "<td>" +
          rebirthCell(row.slots) +
          "</td>" +
          "<td class=\"rebirth-cell-gadgets\">" +
          gadgets +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var cards = levels
      .map(function (row) {
        var br = rebirthBrainrotsListHtml(row.brainrots || []);
        var gadgets = gadgetChipsHtml(row.gadgets || []);
        return (
          '<article class="rebirth-card">' +
          '<div class="rebirth-card__head"><span class="rebirth-card__lvl">' +
          escapeHtml(
            translationTx("rebirthPage.cardLevel", "Level {level}").replace(
              /\{level\}/g,
              String(row.level),
            ),
          ) +
          "</span></div>" +
          '<section class="rebirth-card__block rebirth-card__block--req" aria-labelledby="rebirth-req-' +
          escapeHtml(String(row.level)) +
          '">' +
          '<h3 class="rebirth-card__block-title" id="rebirth-req-' +
          escapeHtml(String(row.level)) +
          '">' +
          escapeHtml(translationTx("rebirthPage.cardRequirements", "Requirements")) +
          "</h3>" +
          '<dl class="rebirth-card__dl">' +
          "<div><dt>" +
          escapeHtml(translationTx("rebirthPage.dtMoney", "Money")) +
          "</dt><dd>" +
          rebirthCell(row.money) +
          "</dd></div>" +
          "<div><dt>" +
          escapeHtml(translationTx("rebirthPage.dtBrainrots", "Brainrots")) +
          '</dt><dd class="rebirth-card__brainrots">' +
          br +
          "</dd></div>" +
          "</dl>" +
          "</section>" +
          '<div class="rebirth-card__divider" aria-hidden="true"></div>' +
          '<section class="rebirth-card__block rebirth-card__block--rew" aria-labelledby="rebirth-rew-' +
          escapeHtml(String(row.level)) +
          '">' +
          '<h3 class="rebirth-card__block-title" id="rebirth-rew-' +
          escapeHtml(String(row.level)) +
          '">' +
          escapeHtml(translationTx("rebirthPage.cardRewards", "Rewards")) +
          "</h3>" +
          '<dl class="rebirth-card__dl">' +
          "<div><dt>" +
          escapeHtml(translationTx("rebirthPage.dtInitialBalance", "Initial balance")) +
          "</dt><dd>" +
          rebirthCell(row.initialBalance) +
          "</dd></div>" +
          "<div><dt>" +
          escapeHtml(translationTx("rebirthPage.dtMoneyMult", "Money mult.")) +
          "</dt><dd>" +
          rebirthCell(row.moneyMult) +
          "</dd></div>" +
          "<div><dt>" +
          escapeHtml(translationTx("rebirthPage.dtLockTime", "Lock time")) +
          "</dt><dd>" +
          rebirthCell(row.lockTime) +
          "</dd></div>" +
          "<div><dt>" +
          escapeHtml(translationTx("rebirthPage.dtSlots", "Slots")) +
          "</dt><dd>" +
          rebirthCell(row.slots) +
          "</dd></div>" +
          '<div class="rebirth-card__gadgets"><dt>' +
          escapeHtml(translationTx("rebirthPage.dtGadgets", "Gadgets")) +
          "</dt><dd>" +
          gadgets +
          "</dd></div>" +
          "</dl>" +
          "</section>" +
          "</article>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="rebirth-inner">' +
      '<div class="rebirth-hero">' +
      "<h1>" +
      escapeHtml(title) +
      "</h1>" +
      updated +
      "</div>" +
      '<div class="rebirth-table-wrap" role="region" aria-label="' +
      escapeAttr(translationTx("rebirthPage.tableAria", "Rebirth levels table")) +
      '">' +
      '<table class="rebirth-table">' +
      thead +
      "<tbody>" +
      tbody +
      "</tbody></table></div>" +
      '<div class="rebirth-cards">' +
      cards +
      "</div>" +
      "</div>";
    hydrateBrainrotAtlasProbes(root);
    } catch (err) {
      root.innerHTML =
        '<div class="rebirth-inner"><p class="loading-state is-error">' +
        escapeHtml(translationTx("rebirthPage.errorRender", "Could not render rebirth table. Try refreshing.")) +
        " " +
        escapeHtml(err && err.message ? String(err.message) : "") +
        "</p></div>";
    }
  }

  function luckyRateHtml(rate) {
    return (
      '<span class="lucky-rate">' +
      escapeHtml(String(rate)) +
      '<span class="lucky-rate__pct">%</span></span>'
    );
  }

  function luckyNameCell(name, catalogName) {
    var label = String(name == null ? "" : name).trim();
    var key = label;
    if (
      catalogName != null &&
      typeof catalogName !== "number" &&
      String(catalogName).trim() !== ""
    ) {
      key = String(catalogName).trim();
    }
    var b = findBrainrotForLink(key);
    var thumbOpts = {
      imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas",
      fallbackClass: "brainrot-thumb__fallback",
    };
    var thumbHtml = "";
    if (b) {
      thumbHtml =
        '<span class="lucky-name__thumb brainrot-thumb brainrot-thumb--lucky-rate" aria-hidden="true">' +
        brainrotThumbMediaHtml(label, b, "default", thumbOpts) +
        "</span>";
    }
    return (
      '<td class="lucky-name lucky-name--with-thumb">' +
      '<div class="lucky-name__row">' +
      thumbHtml +
      '<span class="lucky-name__text">' +
      linkBrainrotNameHtml(name, catalogName) +
      "</span></div></td>"
    );
  }

  /** Section `id` in luckyrots.json → catalog slug for the rot’s header icon */
  var LUCKY_SECTION_HEAD_SLUG = {
    lucky: "lucky-rot",
    grande: "grande-rot",
    pumpkin: "pumpkin-rot",
    present: "present-rot",
    love: "love-rot",
    easter: "easter-rot",
    forest: "forest-rot",
  };

  function luckySectionHeadIconHtml(sec) {
    var id = sec && sec.id ? String(sec.id) : "";
    var slug = LUCKY_SECTION_HEAD_SLUG[id];
    if (!slug) return "";
    var b = findBySlug(slug);
    if (!b) return "";
    var label = String(b.name || slug);
    var thumbOpts = {
      imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas",
      fallbackClass: "brainrot-thumb__fallback",
    };
    return (
      '<span class="lucky-section__icon brainrot-thumb brainrot-thumb--section-rot" aria-hidden="true">' +
      brainrotThumbMediaHtml(label, b, "default", thumbOpts) +
      "</span>"
    );
  }

  function luckyPageHeroIconHtml() {
    var b = findBySlug("lucky-rot");
    if (!b) return "";
    var thumbOpts = {
      imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas",
      fallbackClass: "brainrot-thumb__fallback",
    };
    return (
      '<span class="lucky-hero__icon brainrot-thumb brainrot-thumb--section-rot brainrot-thumb--hero-rot" aria-hidden="true">' +
      brainrotThumbMediaHtml("Lucky Rot", b, "default", thumbOpts) +
      "</span>"
    );
  }

  function renderLuckyRots() {
    var root = $("#luckyrots-root");
    if (!root) return;

    var payload = LUCKY_ROTS_PAYLOAD || { meta: {}, sections: [] };
    var meta = payload.meta || {};
    var sections = payload.sections || [];

    if (!sections.length) {
      root.innerHTML =
        '<div class="lucky-inner"><p class="empty-state">No lucky rot data. Add <code>data/luckyrots.json</code>.</p></div>';
      return;
    }

    var title = titleCaseWords(meta.title || "Lucky Rot Rates");
    var updated = meta.lastUpdated ? lastUpdatedParagraphHtml(meta.lastUpdated, meta.lastUpdated) : "";

    var body = sections
      .map(function (sec) {
        var rawId = sec.id ? String(sec.id) : "";
        var safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "") || "section";
        var intro = sec.intro
          ? '<p class="lucky-section__intro">' + escapeHtml(sec.intro) + "</p>"
          : "";
        var foot = sec.footnote
          ? '<p class="lucky-footnote">' + escapeHtml(sec.footnote) + "</p>"
          : "";

        if (sec.layout === "triple" && sec.columns && sec.columns.length) {
          var cols = sec.columns
            .map(function (col) {
              var rc = RARITY_CLASS[col.rarity] || "rarity-common";
              var rows = (col.entries || [])
                .map(function (e) {
                  return (
                    "<tr>" +
                    luckyNameCell(e.name, e.catalogName) +
                    '<td class="lucky-rate-cell">' +
                    luckyRateHtml(luckyEntryResolvedRate(e)) +
                    "</td></tr>"
                  );
                })
                .join("");
              return (
                '<div class="lucky-col lucky-col--panel" data-rarity="' +
                escapeHtml(col.rarity) +
                '">' +
                '<div class="lucky-col__top">' +
                '<h3 class="lucky-col__head ' +
                rc +
                '"><span class="lucky-col__head-text">' +
                escapeHtml(col.rarity) +
                "</span></h3>" +
                "</div>" +
                '<div class="lucky-table-wrap lucky-table-wrap--panel">' +
                '<table class="lucky-table">' +
                "<thead><tr><th scope=\"col\">Brainrot</th><th scope=\"col\" class=\"lucky-th-rate\">Rate</th></tr></thead><tbody>" +
                rows +
                "</tbody></table></div></div>"
              );
            })
            .join("");
          return (
            '<section class="lucky-section lucky-section--panel" id="lucky-' +
            safeId +
            '">' +
            '<header class="lucky-section__header">' +
            '<h2 class="lucky-section__title">' +
            luckySectionHeadIconHtml(sec) +
            '<span class="lucky-section__title-text">' +
            escapeHtml(titleCaseWords(sec.title)) +
            "</span></h2>" +
            intro +
            "</header>" +
            '<div class="lucky-triple-grid">' +
            cols +
            "</div>" +
            foot +
            "</section>"
          );
        }

        var rc = RARITY_CLASS[sec.columnRarity || "Secret"] || "rarity-secret";
        var rows = (sec.entries || [])
          .map(function (e) {
            return (
              "<tr>" +
              luckyNameCell(e.name, e.catalogName) +
              '<td class="lucky-rate-cell">' +
              luckyRateHtml(luckyEntryResolvedRate(e)) +
              "</td></tr>"
            );
          })
          .join("");
        return (
          '<section class="lucky-section lucky-section--panel" id="lucky-' +
          safeId +
          '">' +
          '<header class="lucky-section__header">' +
          '<h2 class="lucky-section__title">' +
          luckySectionHeadIconHtml(sec) +
          '<span class="lucky-section__title-text">' +
          escapeHtml(titleCaseWords(sec.title)) +
          "</span></h2>" +
          intro +
          "</header>" +
          '<div class="lucky-single lucky-single--panel">' +
          '<div class="lucky-col lucky-col--panel lucky-col--single">' +
          '<div class="lucky-col__top">' +
          '<h3 class="lucky-col__head ' +
          rc +
          '"><span class="lucky-col__head-text">' +
          escapeHtml(sec.columnRarity || "Secret") +
          "</span></h3>" +
          "</div>" +
          '<div class="lucky-table-wrap lucky-table-wrap--panel">' +
          '<table class="lucky-table">' +
          "<thead><tr><th scope=\"col\">Brainrot</th><th scope=\"col\" class=\"lucky-th-rate\">Rate</th></tr></thead><tbody>" +
          rows +
          "</tbody></table></div></div></div></section>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="lucky-inner">' +
      '<div class="lucky-hero rebirth-hero">' +
      '<div class="lucky-hero__title-row">' +
      luckyPageHeroIconHtml() +
      "<h1>" +
      escapeHtml(title) +
      "</h1></div>" +
      updated +
      "</div>" +
      body +
      "</div>";
    (function stripLuckyColEntryCountLabels(r) {
      var ps = r.querySelectorAll(
        ".lucky-col--panel > .lucky-col__top + p, .lucky-col--panel .lucky-col__top > p"
      );
      var i;
      for (i = 0; i < ps.length; i++) {
        var tx = String(ps[i].textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (/^\d+\s+brainrots?$/i.test(tx)) ps[i].remove();
      }
    })(root);
    hydrateBrainrotAtlasProbes(root);
  }

  function getCatalogTypeMultiplier(typeSlug) {
    var sk = String(typeSlug || "").trim();
    var multMap = typeMultsBySlugMap();
    if (sk && multMap[sk] != null) return multMap[sk];
    var types = (BRAINROT_TYPES_CATALOG && BRAINROT_TYPES_CATALOG.types) || [];
    var i;
    for (i = 0; i < types.length; i++) {
      if (types[i].slug === typeSlug) {
        var m = parseTypeMultiplier(types[i].multiplier);
        return m != null ? m : 1;
      }
    }
    return 1;
  }

  function getIncomeMutationTypes() {
    var seen = Object.create(null);
    var merged = [];
    var src =
      TYPE_MULTS_PAYLOAD && Array.isArray(TYPE_MULTS_PAYLOAD.types) ? TYPE_MULTS_PAYLOAD.types : [];
    var cat =
      BRAINROT_TYPES_CATALOG && Array.isArray(BRAINROT_TYPES_CATALOG.types)
        ? BRAINROT_TYPES_CATALOG.types
        : [];
    var pools = [src, cat];
    var pi;
    var i;
    for (pi = 0; pi < pools.length; pi++) {
      var pool = pools[pi];
      for (i = 0; i < pool.length; i++) {
        var t = pool[i];
        if (!t || !t.slug) continue;
        var sk = String(t.slug).trim();
        if (!sk || seen[sk]) continue;
        seen[sk] = 1;
        merged.push({
          slug: sk,
          name: t.name != null && String(t.name).trim() !== "" ? String(t.name) : sk,
          multiplier: getCatalogTypeMultiplier(sk),
        });
      }
    }
    return sortTypeRowsByMultiplierAsc(merged);
  }

  function incomeTraitLabelClean(name) {
    return String(name == null ? "" : name)
      .replace(/\*+/g, "")
      .trim();
  }

  function parseIncomeTraitMult(m) {
    if (typeof m === "number" && m === m) return m;
    if (typeof m === "string" && m.trim() !== "") {
      var p = parseFloat(String(m).replace(/^\+/, "").trim());
      if (p === p) return p;
    }
    return NaN;
  }

  var traitsRefreshPromise = null;

  function fetchTraitsPayload() {
    return fetch("/api/traits", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      })
      .then(function (api) {
        if (api && Array.isArray(api.rows) && api.rows.length) return api;
        return fetch(dataJsonUrl("data/traits.json"), { cache: "no-store" })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          });
      });
  }

  function refreshTraitsFromServer() {
    if (traitsRefreshPromise) return traitsRefreshPromise;
    traitsRefreshPromise = fetchTraitsPayload()
      .then(function (traits) {
        if (traits && typeof traits === "object") {
          TRAITS_PAYLOAD = normalizeTraitsPayload(traits);
          traitsDataReady = true;
        }
        return TRAITS_PAYLOAD;
      })
      .finally(function () {
        traitsRefreshPromise = null;
      });
    return traitsRefreshPromise;
  }

  var INCOME_PICKER_MAX_ROWS = 300;

  function incomePickerRowHtml(b, selectedSlug) {
    var cid =
      typeof b.id === "number" && b.id === b.id ? "#" + String(Math.floor(b.id)) : "";
    var isSel = b.slug === selectedSlug;
    /** Same sprite / atlas pipeline as catalog cards — not per-slug PNGs under types/default/. */
    var thumbOpts = {
      imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas income-brainrot-row__media",
      fallbackClass: "brainrot-thumb__fallback",
    };
    var thumbInner = brainrotThumbMediaHtml(b.name, b, "default", thumbOpts);
    return (
      '<button type="button" role="option" class="income-brainrot-row' +
      (isSel ? " income-brainrot-row--selected" : "") +
      '" data-slug="' +
      escapeHtml(b.slug) +
      '" aria-selected="' +
      (isSel ? "true" : "false") +
      '">' +
      '<span class="income-brainrot-row__thumb brainrot-thumb brainrot-thumb--income-row" aria-hidden="true">' +
      thumbInner +
      "</span>" +
      '<span class="income-brainrot-row__meta">' +
      '<span class="income-brainrot-row__name">' +
      escapeHtml(b.name) +
      "</span>" +
      (cid ? '<span class="income-brainrot-row__id">' + escapeHtml(cid) + "</span>" : "") +
      "</span></button>"
    );
  }

  function incomeRoundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function incomeExportWrapLines(ctx, text, maxW) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!t) return [];
    var words = t.split(" ");
    var lines = [];
    var cur = "";
    var i;
    for (i = 0; i < words.length; i++) {
      var test = cur ? cur + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function resolveIncomeExportThumbSpec(b, typeSlug) {
    var atlas = resolveBrainrotTypeSpriteAny(b, typeSlug);
    if (atlas && atlas.src) {
      return { mode: "atlas", atlas: atlas, loadUrl: atlas.src };
    }
    var tsLookup = typeSlug || "default";
    var t = findBrainrotType(b, tsLookup);
    var rel =
      t && tsLookup !== "default" ? typeIconUrl(b, t) : brainrotIconUrl(b);
    return { mode: "single", atlas: null, loadUrl: assetUrlPath(String(rel).replace(/^\/+/, "")) };
  }

  function drawIncomeExportThumb(ctx, img, spec, dx, dy, dw, dh) {
    if (!img || !spec) return;
    if (spec.mode === "atlas" && spec.atlas) {
      var a = spec.atlas;
      var cols = Math.max(1, Math.floor(a.cols) || 1);
      var rows = Math.max(1, Math.floor(a.rows) || 1);
      var idx = Math.max(0, Math.min(cols * rows - 1, Math.floor(a.index) || 0));
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      if (!iw || !ih) return;
      var cw = iw / cols;
      var ch = ih / rows;
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      var sx = col * cw;
      var sy = row * ch;
      ctx.save();
      incomeRoundRectPath(ctx, dx, dy, dw, dh, 12);
      ctx.clip();
      ctx.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
      ctx.restore();
    } else {
      var iw2 = img.naturalWidth;
      var ih2 = img.naturalHeight;
      if (!iw2 || !ih2) return;
      var scale = Math.max(dw / iw2, dh / ih2);
      var sw = dw / scale;
      var sh = dh / scale;
      var sx2 = (iw2 - sw) * 0.5;
      var sy2 = (ih2 - sh) * 0.5;
      ctx.save();
      incomeRoundRectPath(ctx, dx, dy, dw, dh, 12);
      ctx.clip();
      ctx.drawImage(img, sx2, sy2, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    }
    ctx.save();
    incomeRoundRectPath(ctx, dx, dy, dw, dh, 12);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawIncomeExportTraitIcon(ctx, img, dx, dy, s, glyph, fontStack) {
    var r = Math.min(6, s / 2);
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      var iw = img.naturalWidth;
      var ih = img.naturalHeight;
      var scale = Math.min(s / iw, s / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      var ox = dx + (s - dw) * 0.5;
      var oy = dy + (s - dh) * 0.5;
      ctx.save();
      incomeRoundRectPath(ctx, dx, dy, s, s, r);
      ctx.clip();
      ctx.drawImage(img, 0, 0, iw, ih, ox, oy, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      incomeRoundRectPath(ctx, dx, dy, s, s, r);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "700 11px " + fontStack;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyph || "?", dx + s / 2, dy + s / 2);
    }
    ctx.save();
    incomeRoundRectPath(ctx, dx, dy, s, s, r);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
  }

  function loadImageForIncomeExport(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () {
        resolve(im);
      };
      im.onerror = function () {
        reject(new Error("load"));
      };
      im.src = src;
    });
  }

  function packIncomeExportTraitRowWidths(cells, innerW, gapX) {
    if (!cells || !cells.length) return [];
    var rows = [];
    var row = [];
    var rowW = 0;
    var i;
    for (i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var need = cell.w + (row.length ? gapX : 0);
      if (row.length && rowW + need > innerW + 0.5) {
        rows.push(row);
        row = [cell];
        rowW = cell.w;
      } else {
        row.push(cell);
        rowW += need;
      }
    }
    if (row.length) rows.push(row);
    return rows;
  }

  function buildIncomePreviewPng(b, typeSlug, nameText, outText, breakdownText, selectedTraits) {
    var spec = resolveIncomeExportThumbSpec(b, typeSlug);
    var traits = selectedTraits && selectedTraits.length ? selectedTraits : [];
    var waitFonts =
      typeof document !== "undefined" && document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve();
    var traitRowH = 32;
    var traitIconS = 28;
    return waitFonts
      .then(function () {
        var loads = [loadImageForIncomeExport(spec.loadUrl).catch(function () { return null; })];
        var ti;
        for (ti = 0; ti < traits.length; ti++) {
          loads.push(
            loadImageForIncomeExport(
              traitIconUrlResolved(traits[ti].iconName || traits[ti].name)
            ).catch(function () {
              return null;
            })
          );
        }
        return Promise.all(loads);
      })
      .then(function (images) {
        var thumbImg = images[0];
        var traitImgs = images.slice(1);
        var W = 340;
        var pad = 22;
        var thumbSize = 112;
        var fontStack = '"Barlow", system-ui, sans-serif';

        var c = document.createElement("canvas");
        var ctx = c.getContext("2d");
        if (!ctx) return Promise.reject(new Error("canvas"));

        ctx.font = "600 12px " + fontStack;
        var maxTextW = W - pad * 2;
        var bdLines = incomeExportWrapLines(ctx, breakdownText, maxTextW);
        var breakdownH = bdLines.length ? bdLines.length * 17 : 0;
        var gapAfterBreak = bdLines.length ? 8 : 0;
        var baseAfterOut =
          pad + 14 + 10 + thumbSize + 12 + 22 + 8 + 28 + 10;
        var gapTraitX = 8;
        var traitCells = [];
        var tj;
        for (tj = 0; tj < traits.length; tj++) {
          var tr0 = traits[tj];
          var line0 =
            (tr0.name || "Trait") +
            "  +" +
            (typeof tr0.mult === "number" && tr0.mult === tr0.mult ? String(tr0.mult) : "—");
          traitCells.push({
            tri: tj,
            line: line0,
            w: traitIconS + 10 + ctx.measureText(line0).width,
          });
        }
        var traitRowsPacked = packIncomeExportTraitRowWidths(traitCells, maxTextW, gapTraitX);
        var traitRowCount = traitRowsPacked.length;
        var traitsExtra = traitRowCount
          ? 10 + 14 + 6 + traitRowCount * traitRowH + 10
          : 0;
        var yWatermark = baseAfterOut + breakdownH + gapAfterBreak + traitsExtra;
        var H = yWatermark + 14 + pad;

        var scale = 2;
        c.width = W * scale;
        c.height = H * scale;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);

        ctx.fillStyle = "#0c1020";
        incomeRoundRectPath(ctx, 0, 0, W, H, 12);
        ctx.fill();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
        ctx.lineWidth = 1;
        ctx.stroke();

        var yc = pad;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "800 10px " + fontStack;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("PREVIEW", W / 2, yc);
        yc += 14 + 10;

        var tx = (W - thumbSize) / 2;
        if (thumbImg) {
          drawIncomeExportThumb(ctx, thumbImg, spec, tx, yc, thumbSize, thumbSize);
        } else {
          ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
          incomeRoundRectPath(ctx, tx, yc, thumbSize, thumbSize, 12);
          ctx.fill();
          ctx.fillStyle = "#64748b";
          ctx.font = "700 28px " + fontStack;
          ctx.textBaseline = "middle";
          ctx.fillText(initialGlyph(nameText || b.name || "?"), W / 2, yc + thumbSize / 2);
          ctx.textBaseline = "top";
        }
        yc += thumbSize + 12;

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "700 15px " + fontStack;
        ctx.textBaseline = "top";
        ctx.fillText(nameText || "—", W / 2, yc);
        yc += 22 + 8;

        ctx.fillStyle = "#a5f3fc";
        ctx.font = "800 21px " + fontStack;
        ctx.fillText(outText || "—", W / 2, yc);
        yc += 28 + 10;

        ctx.fillStyle = "#94a3b8";
        ctx.font = "600 12px " + fontStack;
        var bi;
        for (bi = 0; bi < bdLines.length; bi++) {
          ctx.fillText(bdLines[bi], W / 2, yc + bi * 17);
        }
        yc += breakdownH + gapAfterBreak;

        if (traitRowCount) {
          yc += 10;
          ctx.fillStyle = "#94a3b8";
          ctx.font = "800 10px " + fontStack;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("TRAITS", W / 2, yc);
          yc += 14 + 6;
          ctx.fillStyle = "#cbd5e1";
          ctx.font = "600 12px " + fontStack;
          var ri;
          for (ri = 0; ri < traitRowsPacked.length; ri++) {
            var rowCells = traitRowsPacked[ri];
            var rowW = 0;
            var ci;
            for (ci = 0; ci < rowCells.length; ci++) {
              rowW += rowCells[ci].w + (ci ? gapTraitX : 0);
            }
            var rowLeft = pad + (maxTextW - rowW) / 2;
            var rowY = yc + ri * traitRowH;
            var xRun = rowLeft;
            for (ci = 0; ci < rowCells.length; ci++) {
              var cell = rowCells[ci];
              if (ci) xRun += gapTraitX;
              drawIncomeExportTraitIcon(
                ctx,
                traitImgs[cell.tri],
                xRun,
                rowY,
                traitIconS,
                initialGlyph(traits[cell.tri].name || "?"),
                fontStack
              );
              ctx.fillStyle = "#cbd5e1";
              ctx.font = "600 12px " + fontStack;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillText(cell.line, xRun + traitIconS + 10, rowY + traitIconS / 2);
              xRun += cell.w;
            }
          }
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          yc += traitRowCount * traitRowH + 10;
        }

        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "600 11px " + fontStack;
        ctx.fillText("Info from STB-Arab", W / 2, yWatermark);

        return new Promise(function (resolve, reject) {
          c.toBlob(
            function (blob) {
              if (blob) resolve(blob);
              else reject(new Error("blob"));
            },
            "image/png",
            0.95
          );
        });
      });
  }

  function renderIncomeCalculator() {
    var root = $("#income-root");
    if (!root) return;

    refreshTraitsFromServer().then(function () {
      renderIncomeCalculatorInner();
    });
  }

  function renderIncomeCalculatorInner() {
    var root = $("#income-root");
    if (!root) return;

    if (!BRAINROTS.length) {
      root.innerHTML =
        '<div class="income-inner"><p class="empty-state">Catalog not loaded.</p></div>';
      return;
    }

    var types = getIncomeMutationTypes();
    var traitsPayload = TRAITS_PAYLOAD || normalizeTraitsPayload(null);
    var traitsRows = traitsPayload.rows || [];

    var typeOptions = types
      .map(function (t) {
        var m = getCatalogTypeMultiplier(t.slug);
        return (
          '<option value="' +
          escapeHtml(t.slug) +
          '">' +
          escapeHtml(t.name || t.slug) +
          " (" +
          escapeHtml(String(m)) +
          "×)</option>"
        );
      })
      .join("");

    var traitChecks = traitsRows
      .filter(function (row) {
        return parseIncomeTraitMult(row.mult) === parseIncomeTraitMult(row.mult);
      })
      .map(function (row, idx) {
        var m = parseIncomeTraitMult(row.mult);
        var label = incomeTraitLabelClean(row.name);
        var id = "income-trait-" + idx;
        return (
          '<label class="income-trait-label" for="' +
          id +
          '">' +
          '<input type="checkbox" class="income-trait-cb" id="' +
          id +
          '" data-mult="' +
          String(m) +
          '" data-trait-icon-name="' +
          escapeAttr(String(row.name)) +
          '" />' +
          '<span class="income-trait-thumb" aria-hidden="true">' +
          traitThumbHtml(row.name) +
          "</span>" +
          '<span class="income-trait-name">' +
          escapeHtml(label) +
          "</span>" +
          '<span class="income-trait-mult">+' +
          escapeHtml(String(m)) +
          "</span></label>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="income-inner">' +
      '<div class="income-hero">' +
      "<h1>Income Calculator</h1>" +
      '<p class="income-formula"><strong>Income</strong> = base $/s × (type mult + sum of trait mults)</p>' +
      "</div>" +
      '<div class="income-layout">' +
      '<div class="income-panel income-panel--preview">' +
      '<p class="income-preview__label">Preview</p>' +
      '<div id="income-preview-thumb" class="income-preview__thumb brainrot-thumb brainrot-thumb--income-calc"></div>' +
      '<p id="income-preview-name" class="income-preview__name"></p>' +
      '<p id="income-preview-out" class="income-preview__out">—</p>' +
      '<p id="income-preview-breakdown" class="income-preview__breakdown"></p>' +
      '<div id="income-preview-traits-wrap" class="income-preview-traits-wrap" hidden>' +
      '<p class="income-preview__traits-label">Traits</p>' +
      '<div id="income-preview-traits" class="income-preview-traits" aria-label="Selected traits"></div>' +
      "</div>" +
      '<button type="button" id="income-save-preview-btn" class="btn btn-secondary income-save-preview-btn" disabled>Save image</button>' +
      "</div>" +
      '<div class="income-panel income-panel--controls">' +
      '<div class="income-field income-field--brainrot">' +
      '<span class="income-field__label">Brainrot</span>' +
      '<input type="hidden" id="income-brainrot-slug" value="" autocomplete="off" />' +
      '<div class="income-brainrot-picker">' +
      '<label class="sr-only" for="income-brainrot-filter">Filter brainrots</label>' +
      '<div class="income-brainrot-search-wrap">' +
      '<input type="search" id="income-brainrot-filter" class="search-input income-brainrot-filter" placeholder="Filter by name, slug, or #id…" autocomplete="off" spellcheck="false" />' +
      "</div>" +
      '<div id="income-brainrot-cap" class="income-brainrot-cap" hidden></div>' +
      '<div id="income-brainrot-list" class="income-brainrot-list" role="listbox" aria-label="Choose brainrot"></div>' +
      '<p id="income-brainrot-no-match" class="income-brainrot-no-match" hidden>No brainrots match that filter.</p>' +
      "</div></div>" +
      '<label class="income-field">' +
      '<span class="income-field__label">Mutation</span>' +
      '<select id="income-type" class="select income-select" autocomplete="off">' +
      typeOptions +
      "</select></label>" +
      '<fieldset class="income-traits-fieldset">' +
      "<legend>Traits</legend>" +
      (traitChecks
        ? '<div class="income-trait-grid">' + traitChecks + "</div>"
        : '<p class="income-trait-empty">No trait multipliers in <code>data/traits.json</code>.</p>') +
      "</fieldset>" +
      "</div></div></div>";

    var slugInput = root.querySelector("#income-brainrot-slug");
    var listEl = root.querySelector("#income-brainrot-list");
    var capEl = root.querySelector("#income-brainrot-cap");
    var selT = root.querySelector("#income-type");
    var saveBtn = root.querySelector("#income-save-preview-btn");

    function syncIncomeMutationSelect() {
      if (!selT) return;
      var prev = selT.value;
      var list = getIncomeMutationTypes();
      selT.innerHTML = list
        .map(function (t) {
          var m = getCatalogTypeMultiplier(t.slug);
          return (
            '<option value="' +
            escapeHtml(t.slug) +
            '">' +
            escapeHtml(t.name || t.slug) +
            " (" +
            escapeHtml(String(m)) +
            "×)</option>"
          );
        })
        .join("");
      var pick = prev;
      var hasPrev = list.some(function (t) {
        return t.slug === prev;
      });
      if (!hasPrev) {
        pick = list.some(function (t) {
          return t.slug === "default";
        })
          ? "default"
          : list[0]
          ? list[0].slug
          : "";
      }
      selT.value = pick;
    }

    function recalc() {
      var slug = slugInput && slugInput.value ? slugInput.value : "";
      var b = findBySlug(slug);
      var typeSlug = selT && selT.value ? selT.value : "default";
      var typeMult = getCatalogTypeMultiplier(typeSlug);

      var traitSum = 0;
      root.querySelectorAll(".income-trait-cb:checked").forEach(function (cb) {
        var m = parseFloat(cb.getAttribute("data-mult"));
        if (m === m) traitSum += m;
      });

      var base =
        b && typeof b.incomePerSec === "number" && b.incomePerSec === b.incomePerSec
          ? b.incomePerSec
          : 0;
      var inner = typeMult + traitSum;
      var combined = base * inner;

      var nameEl = root.querySelector("#income-preview-name");
      var outEl = root.querySelector("#income-preview-out");
      var breakEl = root.querySelector("#income-preview-breakdown");
      var thumbEl = root.querySelector("#income-preview-thumb");
      var traitsWrapEl = root.querySelector("#income-preview-traits-wrap");
      var traitsStripEl = root.querySelector("#income-preview-traits");

      if (nameEl) nameEl.textContent = b ? b.name : "—";
      if (outEl) outEl.textContent = b ? formatIncomePerSec(combined) : "—";

      if (breakEl) {
        if (!b) {
          breakEl.textContent = "";
        } else {
          breakEl.innerHTML =
            "Base " +
            "<strong>" +
            escapeHtml(formatIncomePerSec(base)) +
            "</strong> × (" +
            escapeHtml(String(typeMult)) +
            (traitSum > 0 ? " + " + escapeHtml(String(traitSum)) : "") +
            ") = " +
            "<strong>" +
            escapeHtml(formatIncomePerSec(combined)) +
            "</strong>";
        }
      }

      if (thumbEl) {
        if (b) {
          thumbEl.innerHTML = brainrotThumbMediaHtml(b.name, b, typeSlug, {
            imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas",
            fallbackClass: "brainrot-thumb__fallback",
          });
          hydrateBrainrotAtlasProbes(root);
        } else {
          thumbEl.innerHTML = "";
        }
      }

      if (traitsWrapEl && traitsStripEl) {
        var traitChips = root.querySelectorAll(".income-trait-cb:checked");
        if (!b || !traitChips.length) {
          traitsWrapEl.hidden = true;
          traitsStripEl.innerHTML = "";
        } else {
          traitsWrapEl.hidden = false;
          traitsStripEl.innerHTML = Array.prototype.map
            .call(traitChips, function (cb) {
              var lab = cb.closest(".income-trait-label");
              var nameN = lab && lab.querySelector(".income-trait-name");
              var nm = nameN ? nameN.textContent.trim() : "Trait";
              var m = cb.getAttribute("data-mult");
              var iconName = cb.getAttribute("data-trait-icon-name") || nm;
              return (
                '<div class="income-preview-trait-chip">' +
                '<span class="income-preview-trait-thumb">' +
                traitThumbHtml(iconName) +
                "</span>" +
                '<span class="income-preview-trait-meta">' +
                '<span class="income-preview-trait-name">' +
                escapeHtml(nm) +
                "</span>" +
                '<span class="income-preview-trait-mult">+' +
                escapeHtml(String(m)) +
                "</span></span></div>"
              );
            })
            .join("");
        }
      }

      if (saveBtn) saveBtn.disabled = !b;
    }

    var filterEl = root.querySelector("#income-brainrot-filter");
    var noMatchEl = root.querySelector("#income-brainrot-no-match");

    function brainrotMatchesQuery(b, q, qSlug) {
      var name = (b.name || "").toLowerCase();
      var slug = (b.slug || "").toLowerCase();
      var cid =
        typeof b.id === "number" && b.id === b.id ? String(Math.floor(b.id)).toLowerCase() : "";
      return (
        !q ||
        name.indexOf(q) >= 0 ||
        slug.indexOf(q) >= 0 ||
        (qSlug && slug.indexOf(qSlug) >= 0) ||
        (q && /^\d+$/.test(q) && cid === q)
      );
    }

    function setBrainrotSlug(slug) {
      if (slugInput) slugInput.value = slug || "";
      if (listEl) {
        listEl.querySelectorAll(".income-brainrot-row").forEach(function (row) {
          var on = row.getAttribute("data-slug") === slug;
          row.classList.toggle("income-brainrot-row--selected", on);
          row.setAttribute("aria-selected", on ? "true" : "false");
        });
      }
      syncIncomeMutationSelect();
      recalc();
    }

    function rebuildBrainrotPicker() {
      if (!listEl || !slugInput) return;
      var q = (filterEl && filterEl.value ? filterEl.value : "").trim().toLowerCase();
      var qSlug = q.replace(/\s+/g, "-");
      var ordered = sortBrainrotsByCatalogId(BRAINROTS);
      var matches = ordered.filter(function (b) {
        return brainrotMatchesQuery(b, q, qSlug);
      });
      var total = matches.length;

      if (total === 0) {
        listEl.innerHTML = "";
        slugInput.value = "";
        if (noMatchEl) noMatchEl.hidden = false;
        if (capEl) {
          capEl.hidden = true;
          capEl.textContent = "";
        }
        syncIncomeMutationSelect();
        recalc();
        return;
      }

      if (noMatchEl) noMatchEl.hidden = true;

      var slice = matches;
      var capped = false;
      if (matches.length > INCOME_PICKER_MAX_ROWS) {
        slice = matches.slice(0, INCOME_PICKER_MAX_ROWS);
        capped = true;
      }

      if (capEl) {
        if (capped && q) {
          capEl.hidden = false;
          capEl.textContent =
            "Showing " +
            INCOME_PICKER_MAX_ROWS +
            " of " +
            total +
            " matches — refine your search.";
        } else if (capped && !q) {
          capEl.hidden = false;
          capEl.textContent =
            "Showing the first " +
            INCOME_PICKER_MAX_ROWS +
            " brainrots (catalog order). Search to find the rest.";
        } else {
          capEl.hidden = true;
          capEl.textContent = "";
        }
      }

      var cur = slugInput.value;
      if (cur && !slice.some(function (b) { return b.slug === cur; })) {
        cur = slice[0] ? slice[0].slug : "";
      }
      if (!cur && slice[0]) cur = slice[0].slug;
      slugInput.value = cur;

      listEl.innerHTML = slice
        .map(function (b) {
          return incomePickerRowHtml(b, cur);
        })
        .join("");

      hydrateBrainrotAtlasProbes(root);
      syncIncomeMutationSelect();
      recalc();
    }

    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest(".income-brainrot-row") : null;
        if (!btn) return;
        var s = btn.getAttribute("data-slug");
        if (s) setBrainrotSlug(s);
      });
    }

    if (filterEl) {
      filterEl.addEventListener("input", rebuildBrainrotPicker);
      filterEl.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          filterEl.value = "";
          rebuildBrainrotPicker();
        }
      });
    }

    var sortedPick = sortBrainrotsByCatalogId(BRAINROTS);
    if (slugInput && sortedPick[0]) slugInput.value = sortedPick[0].slug;
    if (selT) selT.addEventListener("change", recalc);
    root.querySelectorAll(".income-trait-cb").forEach(function (cb) {
      cb.addEventListener("change", recalc);
    });

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var slug = slugInput && slugInput.value ? slugInput.value : "";
        var br = findBySlug(slug);
        if (!br) return;
        var typeSlug = selT && selT.value ? selT.value : "default";
        var nameEl = root.querySelector("#income-preview-name");
        var outEl = root.querySelector("#income-preview-out");
        var breakEl = root.querySelector("#income-preview-breakdown");
        var nameText = nameEl ? nameEl.textContent.trim() : "";
        var outText = outEl ? outEl.textContent.trim() : "";
        var breakdownText = breakEl ? breakEl.innerText.replace(/\s+/g, " ").trim() : "";
        var selectedTraits = [];
        root.querySelectorAll(".income-trait-cb:checked").forEach(function (cb) {
          var lab = cb.closest(".income-trait-label");
          var nameN = lab && lab.querySelector(".income-trait-name");
          var m = parseFloat(cb.getAttribute("data-mult"));
          var nm = nameN ? nameN.textContent.trim() : "";
          var iconName = cb.getAttribute("data-trait-icon-name");
          if (m === m) {
            selectedTraits.push({
              name: nm || "Trait",
              mult: m,
              iconName: iconName || nm,
            });
          }
        });
        saveBtn.disabled = true;
        buildIncomePreviewPng(br, typeSlug, nameText, outText, breakdownText, selectedTraits)
          .then(function (blob) {
            var a = document.createElement("a");
            var u = URL.createObjectURL(blob);
            a.href = u;
            a.download =
              "stb-arab-income-" +
              String(br.slug || "preview")
                .replace(/[^a-z0-9-]+/gi, "-")
                .replace(/^-+|-+$/g, "") +
              ".png";
            a.click();
            URL.revokeObjectURL(u);
          })
          .catch(function () {
            alert("Could not save image.");
          })
          .then(function () {
            var s2 = slugInput && slugInput.value ? slugInput.value : "";
            if (saveBtn) saveBtn.disabled = !findBySlug(s2);
          });
      });
    }

    rebuildBrainrotPicker();
  }

  function renderTraits() {
    var root = $("#traits-root");
    if (!root) return;

    refreshTraitsFromServer().then(function () {
      renderTraitsInner();
    });
  }

  function renderTraitsInner() {
    var root = $("#traits-root");
    if (!root) return;

    var payload = TRAITS_PAYLOAD || normalizeTraitsPayload(null);
    var meta = payload.meta || {};
    var rows = payload.rows || [];

    if (!rows.length) {
      root.innerHTML =
        '<div class="traits-inner"><p class="empty-state">No trait data. Add <code>data/traits.json</code>.</p></div>';
      return;
    }

    var title = meta.title || "Traits Mult";
    var updated = meta.lastUpdated ? lastUpdatedParagraphHtml(meta.lastUpdated, meta.lastUpdated) : "";

    var multNote = payload.multNote
      ? '<p class="traits-mult-note">' + escapeHtml(payload.multNote) + "</p>"
      : "";

    var foot = payload.footnote
      ? '<p class="traits-footnote">' + escapeHtml(payload.footnote) + "</p>"
      : "";

    var tbody = rows
      .map(function (row) {
        var name = row.name || "";
        return (
          "<tr>" +
          '<td class="traits-icon-cell">' +
          traitThumbHtml(name) +
          "</td>" +
          '<td class="traits-name-cell">' +
          escapeHtml(name) +
          "</td>" +
          traitRateCellHtml(row.rate) +
          '<td class="traits-mult-cell">' +
          escapeHtml(formatTraitMult(row.mult)) +
          "</td></tr>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="traits-inner">' +
      '<div class="traits-hero rebirth-hero">' +
      "<h1>" +
      escapeHtml(title) +
      "</h1>" +
      updated +
      "</div>" +
      multNote +
      '<div class="traits-table-wrap">' +
      '<table class="traits-table">' +
      '<thead><tr><th scope="col"><span class="sr-only">Icon</span></th><th scope="col">Trait</th><th scope="col">Rate (%)</th><th scope="col">' +
      escapeHtml(translationTx("traitsPage.thTraitsMult", "Traits Mult")) +
      "</th></tr></thead><tbody>" +
      tbody +
      "</tbody></table></div>" +
      foot +
      "</div>";
  }

  function renderSettingsPage() {
    var root = $("#settings-root");
    if (!root) return;
    var loadFn = window.STBARAB_LOAD_ACCOUNT_SETTINGS_STATE;
    var setPrivacyFn = window.STBARAB_SET_COLLECTION_PRIVACY;
    var setCodesNotifFn = window.STBARAB_SET_CODES_NOTIFICATIONS;
    var tx = translationTx;
    root.innerHTML =
      '<div class="settings-inner"><p class="loading-state">' +
      escapeHtml(tx("settings.loading", "Loading settings…")) +
      "</p></div>";
    if (
      typeof loadFn !== "function" ||
      typeof setPrivacyFn !== "function" ||
      typeof setCodesNotifFn !== "function"
    ) {
      root.innerHTML =
        '<div class="settings-inner"><p class="empty-state">' +
        escapeHtml(tx("settings.errorInit", "Settings could not be initialized.")) +
        "</p></div>";
      return;
    }
    loadFn()
      .then(function (res) {
        if (!res || !res.ok) {
          root.innerHTML =
            '<div class="settings-inner"><p class="empty-state">' +
            escapeHtml(tx("settings.errorLoad", "Could not load settings.")) +
            "</p></div>";
          return;
        }
        if (!res.loggedIn) {
          var authHref = escapeHtml((getAppPathPrefix() || "") + "/api/auth/discord");
          root.innerHTML =
            '<div class="settings-inner">' +
            '<header class="settings-hero">' +
            "<h1>" +
            escapeHtml(tx("settings.heroTitle", "Settings")) +
            "</h1>" +
            '<p class="settings-lede">' +
            escapeHtml(tx("settings.heroGateLede", "Sign in to manage your account and collection preferences.")) +
            "</p>" +
            "</header>" +
            '<div class="settings-gate">' +
            '<a class="btn-primary settings-gate__btn" href="' +
            authHref +
            '">' +
            escapeHtml(tx("settings.gateBtn", "Continue with Discord")) +
            "</a>" +
            "</div></div>";
          return;
        }
        var checked = res.state && res.state.hideFromOthers ? " checked" : "";
        var checkedCodes = res.state && res.state.notifyNewCodes ? " checked" : "";
        root.innerHTML =
          '<div class="settings-inner">' +
          '<header class="settings-hero">' +
          "<h1>" +
          escapeHtml(tx("settings.heroTitle", "Settings")) +
          "</h1>" +
          '<p class="settings-lede">' +
          escapeHtml(
            tx("settings.heroLede", "Manage your account preferences. More sections will appear here later.")
          ) +
          "</p>" +
          "</header>" +
          '<div class="settings-tabs" role="tablist" aria-label="' +
          escapeAttr(tx("settings.tabsAria", "Settings sections")) +
          '">' +
          '<button type="button" class="settings-tab is-active" role="tab" aria-selected="true" disabled>' +
          escapeHtml(tx("settings.tabPrivacy", "Privacy")) +
          "</button>" +
          '<button type="button" class="settings-tab settings-tab--soon" role="tab" aria-selected="false" disabled tabindex="-1">' +
          escapeHtml(tx("settings.tabGeneral", "General")) +
          "</button>" +
          "</div>" +
          '<div class="settings-panel" role="tabpanel">' +
          '<section class="settings-card" aria-labelledby="settings-privacy-heading">' +
          '<div class="settings-card__head">' +
          '<h2 id="settings-privacy-heading" class="settings-card__title">' +
          escapeHtml(tx("settings.privacyTitle", "Collection privacy")) +
          "</h2>" +
          '<p class="settings-card__sub">' +
          escapeHtml(
            tx(
              "settings.privacySub",
              "Control whether people who use your share link can view your tracker."
            )
          ) +
          "</p>" +
          "</div>" +
          '<label class="settings-toggle">' +
          '<input type="checkbox" class="settings-toggle__input" id="settings-hide-collection"' +
          checked +
          " />" +
          '<span class="settings-toggle__track" aria-hidden="true"></span>' +
          '<span class="settings-toggle__text">' +
          "<strong>" +
          escapeHtml(tx("settings.privacyToggleStrong", "Hide my collection from others")) +
          "</strong>" +
          '<span class="settings-toggle__hint">' +
          escapeHtml(
            tx(
              "settings.privacyToggleHint",
              "When enabled, visitors with your share link see that your collection is hidden instead of your progress."
            )
          ) +
          "</span>" +
          "</span></label>" +
          '<p class="settings-foot">' +
          escapeHtml(tx("settings.privacyFootBefore", "Share links are created from the")) +
          ' <a href="#" data-spa-path="/collection">' +
          escapeHtml(tx("settings.privacyFootLink", "Collection")) +
          "</a> " +
          escapeHtml(tx("settings.privacyFootAfter", "page.")) +
          "</p>" +
          "</section>" +
          '<section class="settings-card" aria-labelledby="settings-codes-heading">' +
          '<div class="settings-card__head">' +
          '<h2 id="settings-codes-heading" class="settings-card__title">' +
          escapeHtml(tx("settings.codesNotifTitle", "Code notifications")) +
          "</h2>" +
          '<p class="settings-card__sub">' +
          escapeHtml(
            tx(
              "settings.codesNotifSub",
              "Get browser alerts and Discord bot DMs when new active codes are added."
            )
          ) +
          "</p>" +
          "</div>" +
          '<label class="settings-toggle">' +
          '<input type="checkbox" class="settings-toggle__input" id="settings-notify-codes"' +
          checkedCodes +
          " />" +
          '<span class="settings-toggle__track" aria-hidden="true"></span>' +
          '<span class="settings-toggle__text">' +
          "<strong>" +
          escapeHtml(tx("settings.codesNotifStrong", "Notify me about new codes")) +
          "</strong>" +
          '<span class="settings-toggle__hint">' +
          escapeHtml(
            tx(
              "settings.codesNotifHint",
              "Browser alerts stay on this device. Discord DMs use your linked Discord account when the bot is configured."
            )
          ) +
          "</span>" +
          "</span></label>" +
          "</section>" +
          "</div></div>";
        var cb = document.getElementById("settings-hide-collection");
        if (cb) {
          cb.addEventListener("change", function () {
            setPrivacyFn(!!cb.checked).then(function (out) {
              if (!out || !out.ok) {
                cb.checked = !cb.checked;
                alert(tx("settings.errorPrivacySave", "Could not update privacy. Try signing in again."));
              }
            });
          });
        }
        var cbCodes = document.getElementById("settings-notify-codes");
        if (cbCodes) {
          cbCodes.addEventListener("change", function () {
            var next = !!cbCodes.checked;
            if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
              Notification.requestPermission().then(function (perm) {
                if (perm !== "granted") {
                  cbCodes.checked = false;
                  next = false;
                }
                setCodesNotifFn(next).then(function (out) {
                  if (!out || !out.ok) {
                    cbCodes.checked = !next;
                    alert(tx("settings.errorCodesNotifSave", "Could not update notifications."));
                    return;
                  }
                  if (next) checkForNewCodesAndNotify();
                });
              });
              return;
            }
            setCodesNotifFn(next).then(function (out) {
              if (!out || !out.ok) {
                cbCodes.checked = !next;
                alert(tx("settings.errorCodesNotifSave", "Could not update notifications."));
                return;
              }
              if (next) checkForNewCodesAndNotify();
            });
          });
        }
        var settingsInner = root.querySelector(".settings-inner");
        if (settingsInner) {
          $all("[data-spa-path]", settingsInner).forEach(function (el) {
            el.setAttribute("href", spaHref(el.getAttribute("data-spa-path")));
          });
        }
      })
      .catch(function () {
        root.innerHTML =
          '<div class="settings-inner"><p class="empty-state">' +
          escapeHtml(tx("settings.errorLoad", "Could not load settings.")) +
          "</p></div>";
      });
  }

  function renderCreditsPage() {
    var root = $("#credits-root");
    if (!root) return;
    var tx = translationTx;
    root.innerHTML =
      '<div class="credits-inner">' +
      '<div class="credits-hero">' +
      "<h1>" +
      escapeHtml(tx("creditsPage.title", "Project credits")) +
      "</h1>" +
      '<p class="credits-lede">' +
      escapeHtml(tx("creditsPage.subtitle", "Built and maintained for STB-Arab.")) +
      "</p>" +
      "</div>" +
      '<div class="credits-card">' +
      '<div class="credits-row"><div class="credits-name">cryptography.sh</div><div class="credits-role">' +
      escapeHtml(tx("creditsPage.roleDeveloper", "Developer and site maintainer")) +
      "</div></div>" +
      "</div>" +
      "</div>";
  }

  function normalizeLlamaPayload(l) {
    if (!l || typeof l !== "object") return null;
    return l;
  }

  function safeSiteAlertUrl(u) {
    if (u == null || typeof u !== "string") return "";
    var s = u.trim();
    if (/^https:\/\//i.test(s)) return s;
    return "";
  }

  function normalizeSiteAlertsPayload(j) {
    if (!j || typeof j !== "object") return { alerts: [] };
    var raw = j.alerts;
    if (!Array.isArray(raw)) return { alerts: [] };
    var out = [];
    var i;
    for (i = 0; i < raw.length; i++) {
      var a = raw[i];
      if (!a || typeof a !== "object") continue;
      var msg = a.message != null ? String(a.message).trim() : "";
      if (!msg) continue;
      var id =
        a.id != null && String(a.id).trim() !== ""
          ? String(a.id).trim()
          : "alert-" + i + "-" + msg.slice(0, 32).replace(/\s+/g, "-");
      var tone = a.tone != null && String(a.tone).trim() !== "" ? a.tone : a.level;
      tone = String(tone || "")
        .trim()
        .toLowerCase();
      if (tone !== "danger" && tone !== "warning" && tone !== "info") tone = "info";
      var dismissible = a.dismissible !== false;
      var linkUrl = safeSiteAlertUrl(a.linkUrl);
      var linkLabel = a.linkLabel != null ? String(a.linkLabel).trim() : "";
      if (linkUrl && !linkLabel) linkLabel = "Link";
      out.push({
        id: id,
        message: msg,
        tone: tone,
        dismissible: dismissible,
        linkUrl: linkUrl,
        linkLabel: linkLabel,
      });
    }
    return { alerts: out };
  }

  function getDismissedSiteAlertIds() {
    try {
      var raw = localStorage.getItem(SITE_ALERTS_STORAGE_KEY);
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(function (x) { return typeof x === "string"; }) : [];
    } catch (e) {
      return [];
    }
  }

  function dismissSiteAlert(id) {
    if (!id) return;
    var cur = getDismissedSiteAlertIds();
    if (cur.indexOf(id) >= 0) return;
    cur.push(id);
    try {
      localStorage.setItem(SITE_ALERTS_STORAGE_KEY, JSON.stringify(cur));
    } catch (e) {}
    renderSiteAlerts();
  }

  function renderSiteAlerts() {
    var root = $("#site-alerts-root");
    if (!root) return;
    var p = SITE_ALERTS_PAYLOAD;
    var list = p && Array.isArray(p.alerts) ? p.alerts : [];
    var dismissed = getDismissedSiteAlertIds();
    var visible = list.filter(function (a) {
      return dismissed.indexOf(a.id) === -1;
    });
    if (!visible.length) {
      root.innerHTML = "";
      root.hidden = true;
      return;
    }
    root.hidden = false;
    root.innerHTML = visible
      .map(function (a) {
        var role = a.tone === "danger" ? "alert" : "status";
        var toneClass = "site-alert--" + a.tone;
        var iconSvg =
          a.tone === "danger"
            ? '<svg class="site-alert__icon-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13 2L3 14h8l-1.5 8L21 9h-8.5L13 2z"/></svg>'
            : a.tone === "warning"
              ? '<svg class="site-alert__icon-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M1 21L12 2l11 19H1zm11-9h2v6h-2v-6zm0 8a1 1 0 11-2 0 1 1 0 012 0z"/></svg>'
              : '<svg class="site-alert__icon-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
        var dismissBtn = a.dismissible
          ? '<button type="button" class="site-alert__dismiss" aria-label="Dismiss announcement" data-alert-dismiss="' +
            escapeAttr(a.id) +
            '"><span aria-hidden="true">×</span></button>'
          : "";
        var link =
          a.linkUrl && a.linkLabel
            ? '<a class="site-alert__cta" href="' +
              escapeHtml(a.linkUrl) +
              '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(a.linkLabel) +
              '<span class="site-alert__cta-chev" aria-hidden="true">→</span></a>'
            : "";
        return (
          '<div class="site-alert ' +
          toneClass +
          '" role="' +
          role +
          '" data-alert-id="' +
          escapeAttr(a.id) +
          '">' +
          '<div class="site-alert__shell">' +
          '<div class="site-alert__icon" aria-hidden="true">' +
          iconSvg +
          "</div>" +
          '<div class="site-alert__body">' +
          '<p class="site-alert__text">' +
          escapeHtml(a.message) +
          "</p>" +
          link +
          "</div>" +
          dismissBtn +
          "</div></div>"
        );
      })
      .join("");
    root.querySelectorAll("[data-alert-dismiss]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-alert-dismiss");
        if (id) dismissSiteAlert(id);
      });
    });
  }

  function llamaTableCellHtml(val) {
    if (val === null || val === undefined || val === "") {
      return '<span class="llama-cell--empty">—</span>';
    }
    return escapeHtml(String(val));
  }

  function wireLlamaBrainBrowser(root, counts, brainRows) {
    var browserEl = root && root.querySelector ? root.querySelector("#llama-brain-browser") : null;
    if (!browserEl || browserEl.getAttribute("data-llama-brain-wired") === "1") return;
    browserEl.setAttribute("data-llama-brain-wired", "1");
    var rail = browserEl.querySelector("#llama-brain-rail");
    var host = browserEl.querySelector("#llama-brain-view-host");
    if (!rail || !host) return;
    var picks = rail.querySelectorAll(".llama-brain-pick");
    if (!picks.length) return;
    function setPressed(activeBtn) {
      picks.forEach(function (b) {
        b.classList.toggle("is-active", b === activeBtn);
        b.setAttribute("aria-pressed", b === activeBtn ? "true" : "false");
      });
    }
    function renderPanel(ix) {
      if (ix < 0 || ix >= counts.length) return;
      var n = counts[ix];
      var rowsHtml = brainRows
        .map(function (row) {
          var rates = Array.isArray(row.rates) ? row.rates : [];
          var v = rates[ix];
          if (v === null || v === undefined || v === "") return "";
          return (
            '<li class="llama-brain-out">' +
            '<span class="llama-brain-out__name">' +
            linkBrainrotNameHtml(row.name || "", row.catalogName) +
            "</span>" +
            '<span class="llama-brain-out__pct">' +
            llamaTableCellHtml(v) +
            "</span></li>"
          );
        })
        .join("");
      if (!rowsHtml) {
        rowsHtml =
          '<li class="llama-brain-out llama-brain-out--empty muted">No rates for this interaction.</li>';
      }
      host.innerHTML =
        '<h3 class="llama-brain-title">Interaction ' +
        escapeHtml(String(n)) +
        "</h3>" +
        '<ul class="llama-brain-outcomes">' +
        rowsHtml +
        "</ul>";
    }
    picks.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ix = parseInt(btn.getAttribute("data-column-index"), 10);
        if (isNaN(ix)) return;
        setPressed(btn);
        renderPanel(ix);
      });
    });
    var active0 = rail.querySelector(".llama-brain-pick.is-active") || picks[0];
    setPressed(active0);
    var i0 = parseInt(active0.getAttribute("data-column-index"), 10);
    renderPanel(isNaN(i0) ? 0 : i0);
  }

  function renderLlamaRots() {
    var root = $("#llamarots-root");
    if (!root) return;

    var p = LLAMA_ROTS_PAYLOAD;
    if (!p) {
      root.innerHTML =
        '<div class="llama-inner"><p class="empty-state">No data. Add <code>data/llamarots.json</code>.</p></div>';
      return;
    }

    var meta = p.meta || {};
    var title = titleCaseWords(meta.title || "Llama Rot Rates");
    var updated = meta.lastUpdated ? lastUpdatedParagraphHtml(meta.lastUpdated, meta.lastUpdated) : "";

    var introHtml = Array.isArray(p.intro) && p.intro.length
      ? '<ul class="llama-intro">' +
        p.intro
          .map(function (line) {
            return "<li>" + escapeHtml(line) + "</li>";
          })
          .join("") +
        "</ul>"
      : "";

    var rebirthRows = Array.isArray(p.rebirthRows) ? p.rebirthRows : [];
    var rebirthTbody = rebirthRows
      .map(function (r) {
        return (
          "<tr><td>" +
          escapeHtml(String(r.level)) +
          "</td><td>" +
          escapeHtml(String(r.interactions)) +
          "</td></tr>"
        );
      })
      .join("");

    var rebirthBlock =
      '<section class="llama-section llama-section--rebirth" aria-labelledby="llama-rebirth-heading">' +
      '<h2 id="llama-rebirth-heading" class="llama-section__title">Rebirth level · allowed interactions</h2>' +
      '<div class="llama-rebirth-card">' +
      '<div class="lucky-table-wrap">' +
      '<table class="lucky-table llama-rebirth-table">' +
      "<thead><tr><th>Rebirth level</th><th>Allowed interactions</th></tr></thead><tbody>" +
      rebirthTbody +
      "</tbody></table></div></div></section>";

    var spawnCols = Array.isArray(p.spawnRateColumns) ? p.spawnRateColumns : [];
    var spawnRows = Array.isArray(p.spawnRateRows) ? p.spawnRateRows : [];
    var spawnThead =
      "<tr><th scope=\"col\">Event</th>" +
      spawnCols
        .map(function (c) {
          return "<th scope=\"col\">" + escapeHtml(c) + "</th>";
        })
        .join("") +
      "</tr>";
    var spawnTbody = spawnRows
      .map(function (row) {
        var eventName = row.event != null ? String(row.event) : "";
        var cells = spawnCols
          .map(function (col) {
            var v = row[col];
            return "<td>" + llamaTableCellHtml(v) + "</td>";
          })
          .join("");
        return (
          "<tr><th scope=\"row\">" +
          escapeHtml(eventName) +
          "</th>" +
          cells +
          "</tr>"
        );
      })
      .join("");

    var spawnTitle = titleCaseWords(p.spawnRatesTitle || "Llama Rot Spawn Rates");
    var spawnNote = p.spawnRatesNote
      ? '<p class="llama-spawn-note">' + escapeHtml(p.spawnRatesNote) + "</p>"
      : "";
    var spawnBlock =
      '<section class="llama-section llama-section--spawn" aria-labelledby="llama-spawn-heading">' +
      '<h2 id="llama-spawn-heading" class="llama-section__title">' +
      escapeHtml(spawnTitle) +
      "</h2>" +
      spawnNote +
      '<div class="llama-table-scroll llama-table-scroll--spawn">' +
      '<table class="lucky-table llama-spawn-table">' +
      "<thead>" +
      spawnThead +
      "</thead><tbody>" +
      spawnTbody +
      "</tbody></table></div></section>";

    var codesNote = p.codesNote
      ? '<p class="llama-codes-note">' + escapeHtml(p.codesNote) + "</p>"
      : "";

    var brainIntro = p.brainrotSectionIntro
      ? '<p class="llama-brain-intro">' + escapeHtml(p.brainrotSectionIntro) + "</p>"
      : "";

    var ratesNote = p.interactionRatesNote
      ? '<p class="llama-rates-note">' + escapeHtml(p.interactionRatesNote) + "</p>"
      : "";

    var hints = Array.isArray(p.interactionColumnHints) ? p.interactionColumnHints : [];
    var hintParts = hints.filter(function (h) {
      return h && String(h).trim();
    });
    var hintsHtml = hintParts.length
      ? '<p class="llama-interaction-hints">' +
        hintParts.map(function (h) {
          return escapeHtml(String(h));
        }).join(" · ") +
        "</p>"
      : "";

    var counts = Array.isArray(p.interactionCounts) ? p.interactionCounts : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var brainRows = Array.isArray(p.brainrotRows) ? p.brainrotRows : [];
    var railHtml = counts
      .map(function (n, i) {
        return (
          '<button type="button" class="llama-brain-pick' +
          (i === 0 ? " is-active" : "") +
          '" data-column-index="' +
          i +
          '" aria-pressed="' +
          (i === 0 ? "true" : "false") +
          '" aria-label="' +
          escapeAttr("Interaction " + String(n)) +
          '">' +
          escapeHtml(String(n)) +
          "</button>"
        );
      })
      .join("");
    var brainBlock =
      '<section class="llama-section llama-section--brain" aria-labelledby="llama-brain-heading">' +
      '<h2 id="llama-brain-heading" class="llama-section__title">Brainrot rates by interaction</h2>' +
      brainIntro +
      ratesNote +
      hintsHtml +
      '<div class="llama-brain-browser" id="llama-brain-browser">' +
      '<div class="llama-brain-browser__top">' +
      '<p class="llama-brain-browser__head">Brainrot rates by interaction</p>' +
      '<span class="llama-brain-browser__pill">%</span>' +
      "</div>" +
      '<div class="llama-brain-browser__body">' +
      '<nav class="llama-brain-rail" id="llama-brain-rail" aria-label="Select interaction column">' +
      railHtml +
      "</nav>" +
      '<div class="llama-brain-panel">' +
      '<div id="llama-brain-view-host" class="llama-brain-view-host"></div>' +
      "</div></div></div></section>";

    var footerNotes = Array.isArray(p.footerNotes) ? p.footerNotes : [];
    var footerHtml = footerNotes.length
      ? '<div class="llama-footer-notes">' +
        footerNotes
          .map(function (line) {
            return "<p>" + escapeHtml(line) + "</p>";
          })
          .join("") +
        "</div>"
      : "";

    root.innerHTML =
      '<div class="llama-inner">' +
      '<div class="llama-hero rebirth-hero">' +
      "<h1>" +
      escapeHtml(title) +
      "</h1>" +
      updated +
      "</div>" +
      introHtml +
      spawnBlock +
      codesNote +
      brainBlock +
      rebirthBlock +
      footerHtml +
      "</div>";
    wireLlamaBrainBrowser(root, counts, brainRows);
  }

  function renderNotFound(route) {
    var root = $("#notfound-root");
    if (!root) return;
    var p = route && route.path ? String(route.path) : "";
    var mascotUrl = escapeHtml(assetUrlPath("assets/images/404-mascot-67.png"));
    var homeHref = escapeHtml(spaHref("/"));
    var catHref = escapeHtml(spaHref("/brainrots"));
    var pathBlock =
      p !== ""
        ? '<p class="notfound-path-line" id="notfound-spa-path-line">Requested path: <code>' +
          escapeHtml(p) +
          "</code></p>"
        : "";
    root.innerHTML =
      '<div class="notfound-inner notfound-inner--splash">' +
      '<figure class="notfound-404-mascot">' +
      '<img src="' +
      mascotUrl +
      '" alt="Playful 67 mascot" loading="eager" decoding="async" />' +
      "</figure>" +
      '<div class="notfound-404-copy">' +
      '<p class="eyebrow">Page not found</p>' +
      '<h1 class="notfound-404-title" aria-label="404">404</h1>' +
      '<p class="notfound-404-lead">That URL is not a page on this site. It may have moved, or the link you followed could be out of date.</p>' +
      pathBlock +
      '<div class="notfound-404-actions">' +
      '<a class="btn-primary" href="' +
      homeHref +
      '" data-spa-path="/">Back to home</a>' +
      '<a class="btn-secondary" href="' +
      catHref +
      '" data-spa-path="/brainrots">Brainrot catalog</a>' +
      "</div></div></div>";
    document.title = "Not found · " + BASE_TITLE;
  }

  var eternalMachineUi = {
    slots: [null, null, null, null, null],
    pickerSlot: null,
    pickerSelectedSlug: null,
    pickerDraft: { typeSlug: "default", traits: [] },
    inited: false,
    usePremiumRates: false,
    muteFuseAudio: false,
  };
  /** Sheet reference: tier browser only; independent of fuse premium toggle. */
  var eternalMachineRefUi = {
    tierIndex: 0,
    usePremiumRates: false,
  };

  function eternalMachineRevealReference() {
    var shell = $("#em-reference-shell");
    var showWrap = $("#em-reference-show-wrap");
    if (shell) {
      shell.hidden = false;
      shell.setAttribute("aria-hidden", "false");
    }
    if (showWrap) showWrap.hidden = true;
  }

  function eternalMachineHideReference() {
    var shell = $("#em-reference-shell");
    var showWrap = $("#em-reference-show-wrap");
    if (shell) {
      shell.hidden = true;
      shell.setAttribute("aria-hidden", "true");
    }
    if (showWrap) showWrap.hidden = false;
  }

  var eternalMachineFuseAudio = null;

  function eternalMachineCloseFuseModal() {
    var ov = $("#em-fuse-overlay");
    if (ov) ov.hidden = true;
    if (document && document.body) document.body.classList.remove("eternal-machine-fuse-open");
    try {
      if (eternalMachineFuseAudio) {
        eternalMachineFuseAudio.pause();
        eternalMachineFuseAudio.currentTime = 0;
      }
    } catch (eFusePause) {}
  }

  function eternalMachineTryPlayFuseSound(won) {
    if (eternalMachineUi.muteFuseAudio) return;
    if (!won) return;
    var soundJson =
      won.sound != null && String(won.sound).trim() !== ""
        ? String(won.sound).trim()
        : brainrotDefaultSoundJsonPath(won);
    if (!soundJson) return;
    var wavUrl = soundWavPublicUrlFromJson(soundJson);
    var m4aUrl = /\.m4a$/i.test(String(soundJson)) ? soundM4aPublicUrlFromJson(soundJson) : wavUrl;
    if (!wavUrl) return;
    try {
      if (eternalMachineFuseAudio) {
        try {
          eternalMachineFuseAudio.pause();
          eternalMachineFuseAudio.src = "";
          eternalMachineFuseAudio.load();
        } catch (eDiscard) {}
      }
      var audio = new Audio();
      eternalMachineFuseAudio = audio;
      audio.volume = 0.52;
      function playClip() {
        if (eternalMachineFuseAudio !== audio) return;
        var p = audio.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
      if (m4aUrl !== wavUrl) {
        audio.addEventListener(
          "error",
          function onErr() {
            if (eternalMachineFuseAudio !== audio) return;
            audio.src = wavUrl;
            audio.load();
            playClip();
          },
          { once: true },
        );
        audio.src = m4aUrl;
      } else {
        audio.src = wavUrl;
      }
      audio.load();
      playClip();
    } catch (eFuseAu) {}
  }

  function eternalMachineWireFuseModal(root) {
    if (!root || root.getAttribute("data-em-fuse-wire") === "1") return;
    root.setAttribute("data-em-fuse-wire", "1");
    var fuseOv = $("#em-fuse-overlay");
    if (fuseOv) {
      fuseOv.addEventListener("click", function (e) {
        if (e.target === fuseOv) eternalMachineCloseFuseModal();
      });
    }
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("#em-fuse-close") || t.closest(".em-fuse-done")) {
        e.preventDefault();
        eternalMachineCloseFuseModal();
      }
    });
    document.addEventListener("keydown", function (e) {
      var ov = $("#em-fuse-overlay");
      if (!ov || ov.hidden) return;
      if (e.key === "Escape") eternalMachineCloseFuseModal();
    });
  }

  function eternalMachineNormalizeSlot(saved) {
    if (!saved) return null;
    if (saved.slug && typeof saved.typeSlug === "string") {
      var tsSaved = String(saved.typeSlug || "default");
      if (!eternalMachineTypeAllowed(tsSaved)) tsSaved = "default";
      return {
        slug: String(saved.slug),
        typeSlug: tsSaved,
        traits: Array.isArray(saved.traits) ? saved.traits.slice() : [],
      };
    }
    if (saved.slug && saved.name) {
      return { slug: String(saved.slug), typeSlug: "default", traits: [] };
    }
    return null;
  }

  function eternalMachineResolveSlotB(saved) {
    var st = eternalMachineNormalizeSlot(saved);
    if (!st) return null;
    var i;
    for (i = 0; i < BRAINROTS.length; i++) {
      if (BRAINROTS[i].slug === st.slug) return BRAINROTS[i];
    }
    return null;
  }

  function eternalMachineSlotRarityOk(b) {
    if (!b) return false;
    var k = canonicalRarityBucketKey(b.rarity);
    if (k === "Goat" || k === "Lucky Rots" || k === "Admin") return false;
    var ri = rarityOrderIndex(k);
    var mi = rarityOrderIndex("Mythic");
    return ri !== 999 && ri >= mi;
  }

  function eternalMachineSlotLaSuperiorPremiumRarity(b) {
    if (!b) return false;
    var k = canonicalRarityBucketKey(b.rarity);
    return k === "Eternal" || k === "Brainrot God";
  }

  function eternalMachineSlotsHaveLaSuperiorPremiumRarity(slottedBrainrots) {
    if (!slottedBrainrots || !slottedBrainrots.length) return false;
    var i;
    for (i = 0; i < slottedBrainrots.length; i++) {
      if (eternalMachineSlotLaSuperiorPremiumRarity(slottedBrainrots[i])) return true;
    }
    return false;
  }

  function eternalMachineTypeMultiplierForSlot(b, typeSlug) {
    var ts = typeSlug || "default";
    var m = getCatalogTypeMultiplier(ts);
    return typeof m === "number" && m === m ? m : 1;
  }

  function eternalMachineTraitAdditiveForNames(names) {
    if (!names || !names.length) return 0;
    var rows = (TRAITS_PAYLOAD && TRAITS_PAYLOAD.rows) || [];
    if (!rows.length) return 0;
    var by = {};
    var i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.name) continue;
      var m = typeof r.mult === "number" && r.mult === r.mult ? r.mult : Number(r.mult);
      if (!(m === m)) continue;
      by[String(r.name)] = m;
    }
    var sum = 0;
    for (i = 0; i < names.length; i++) {
      var n = String(names[i] || "");
      if (Object.prototype.hasOwnProperty.call(by, n)) sum += by[n];
    }
    return sum;
  }

  function eternalMachineSlotIncome(saved, b) {
    var st = eternalMachineNormalizeSlot(saved);
    if (!st || !b) return 0;
    var base = typeof b.incomePerSec === "number" && b.incomePerSec === b.incomePerSec ? b.incomePerSec : 0;
    var typeMult = eternalMachineTypeMultiplierForSlot(b, st.typeSlug || "default");
    var traitAdd = eternalMachineTraitAdditiveForNames(st.traits || []);
    var inner = typeMult + traitAdd;
    if (!(inner === inner) || inner <= 0) inner = 1;
    return base * inner;
  }

  function eternalMachinePremiumRatesAvailable() {
    var ref = ETERNAL_MACHINE_REFERENCE;
    return !!(ref && Array.isArray(ref.premiumTiers) && ref.premiumTiers.length);
  }

  function eternalMachineActiveTierRows() {
    var p = ETERNAL_MACHINE_RATES;
    if (!p || !Array.isArray(p.tiers)) return [];
    if (eternalMachineUi.usePremiumRates && eternalMachinePremiumRatesAvailable()) {
      return ETERNAL_MACHINE_REFERENCE.premiumTiers;
    }
    return p.tiers;
  }

  /** Tier JSON uses M/s (millions per second); catalog `incomePerSec` is money per second. */
  function eternalMachineEffectiveIncomeMs(effectivePerSec) {
    var v = Number(effectivePerSec);
    if (!(v === v) || v <= 0) return 0;
    return v / 1000000;
  }

  /** @param {number} totalBaseIncomePerSec sum of catalog base incomes ($/s), not type/trait and not Verse-style effective. */
  function eternalMachineResolveTierRow(totalBaseIncomePerSec) {
    var totalMs = eternalMachineEffectiveIncomeMs(totalBaseIncomePerSec);
    var tiers = eternalMachineActiveTierRows();
    if (!tiers.length) return null;
    var chosen = null;
    var i;
    for (i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      if (!t || typeof t.minIncomeMs !== "number" || typeof t.tier !== "number") continue;
      if (totalMs > t.minIncomeMs) {
        if (!chosen || t.tier > chosen.tier) chosen = t;
      }
    }
    return chosen;
  }

  function eternalMachineWeightedPick(weights) {
    if (!weights || !weights.length) return -1;
    var sum = 0;
    var i;
    for (i = 0; i < weights.length; i++) {
      var w = weights[i];
      if (typeof w === "number" && w === w && w > 0) sum += w;
    }
    if (sum <= 0) return -1;
    var r = Math.random() * sum;
    for (i = 0; i < weights.length; i++) {
      w = weights[i];
      if (!(typeof w === "number" && w === w && w > 0)) continue;
      r -= w;
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  function findBrainrotForEternalColumn(colName) {
    if (!colName || !String(colName).trim() || !BRAINROTS.length) return null;
    var c = String(colName).trim();
    var i;
    for (i = 0; i < BRAINROTS.length; i++) {
      if (String(BRAINROTS[i].name) === c) return BRAINROTS[i];
    }
    for (i = 0; i < BRAINROTS.length; i++) {
      var n = String(BRAINROTS[i].name);
      if (n.indexOf(c) !== -1 || c.indexOf(n) !== -1) return BRAINROTS[i];
    }
    return null;
  }

  function eternalMachineFindGroupByLabel(label) {
    var ref = ETERNAL_MACHINE_REFERENCE;
    if (!ref || !Array.isArray(ref.machineGroups)) return null;
    var i;
    for (i = 0; i < ref.machineGroups.length; i++) {
      var g = ref.machineGroups[i];
      if (g && String(g.label || "") === String(label || "")) return g;
    }
    return null;
  }

  function eternalMachineOutcomeThumbHtml(colName) {
    var b = findBrainrotForEternalColumn(colName);
    if (b) {
      return '<span class="em-outcome-thumb brainrot-thumb">' + brainrotThumbMediaHtml(b.name, b, "default", {}) + "</span>";
    }
    var g = eternalMachineFindGroupByLabel(colName);
    if (g && Array.isArray(g.members) && g.members.length) {
      var byName = findByNameLoose(g.members[0]);
      if (byName) {
        return (
          '<span class="em-outcome-thumb brainrot-thumb">' +
          brainrotThumbMediaHtml(byName.name, byName, "default", {}) +
          "</span>"
        );
      }
    }
    return '<span class="em-outcome-thumb em-outcome-thumb--txt">' + escapeHtml(initialGlyph(colName)) + "</span>";
  }

  function eternalMachineResolveColumnCandidates(colName) {
    var g = eternalMachineFindGroupByLabel(colName);
    if (g && Array.isArray(g.members) && g.members.length) {
      return g.members
        .map(function (n) {
          var label = String(n == null ? "" : n).trim();
          if (!label) return null;
          var b = findByNameLoose(label) || findBrainrotForEternalColumn(label) || findBrainrotForLink(label);
          if (b) return b;
          return { name: label, slug: slugifyBrainrotLookupKey(label) || "unknown" };
        })
        .filter(Boolean);
    }
    var b = findBrainrotForEternalColumn(colName);
    return b ? [b] : [];
  }

  function eternalMachineBrainrotSupportedTypeSlugs(b) {
    if (!b || !Array.isArray(b.types) || !b.types.length) return ["default"];
    var seen = {};
    return b.types
      .map(function (t) {
        return String((t && t.slug) || "").trim().toLowerCase();
      })
      .filter(function (slug) {
        if (!slug || seen[slug]) return false;
        seen[slug] = true;
        return true;
      });
  }

  function eternalMachineSlottedBaseIncomeRatios() {
    var slots = eternalMachineUi.slots || [];
    var rows = [];
    var totalBase = 0;
    var i;
    for (i = 0; i < slots.length; i++) {
      var st = eternalMachineNormalizeSlot(slots[i]);
      var b = eternalMachineResolveSlotB(slots[i]);
      if (!st || !b || !eternalMachineSlotRarityOk(b)) continue;
      var base = Number(b.incomePerSec) || 0;
      if (!(base > 0)) continue;
      rows.push({
        typeSlug: String(st.typeSlug || "default").toLowerCase(),
        traits: Array.isArray(st.traits) ? st.traits.slice() : [],
        baseIncome: base,
      });
      totalBase += base;
    }
    if (!(totalBase > 0) || !rows.length) return [];
    return rows.map(function (row) {
      return {
        typeSlug: row.typeSlug,
        traits: row.traits,
        ratio: row.baseIncome / totalBase,
      };
    });
  }

  function eternalMachineParseTypePct(v) {
    if (typeof v === "number" && v === v) return v;
    var n = Number(String(v == null ? "" : v).trim());
    return n === n ? n : null;
  }

  function eternalMachineTypeNameForSlug(slug) {
    var sk = String(slug || "").trim().toLowerCase();
    if (sk === "ice-fire") return "Ice & Fire";
    var all = getIncomeMutationTypes();
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i].slug === sk) return String(all[i].name || sk);
    }
    return sk
      .split("-")
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  var ETERNAL_MACHINE_TYPE_RATE_FALLBACK_PCT = { magical: 2 };

  function eternalMachinePctForSlug(slug, wo, existingBySlug) {
    if (wo && Object.prototype.hasOwnProperty.call(wo, slug)) {
      return eternalMachineParseTypePct(wo[slug]);
    }
    if (existingBySlug[slug]) {
      return eternalMachineParseTypePct(existingBySlug[slug].pct);
    }
    if (Object.prototype.hasOwnProperty.call(ETERNAL_MACHINE_TYPE_RATE_FALLBACK_PCT, slug)) {
      return ETERNAL_MACHINE_TYPE_RATE_FALLBACK_PCT[slug];
    }
    return null;
  }

  function eternalMachineBuildUnifiedTypeRates() {
    var ref = ETERNAL_MACHINE_REFERENCE;
    var existing = ref && Array.isArray(ref.typeRates) ? ref.typeRates : [];
    var spawn = TYPE_SPAWN_EVENT_TABLES;
    var wo = spawn && spawn.withoutEvent ? spawn.withoutEvent["150"] : null;
    var order = spawn && Array.isArray(spawn.typeOrder) ? spawn.typeOrder : [];
    var existingBySlug = Object.create(null);
    var out = [];
    var seen = Object.create(null);
    var i;
    for (i = 0; i < existing.length; i++) {
      var er = existing[i];
      if (!er || !er.slug) continue;
      existingBySlug[String(er.slug).trim().toLowerCase()] = er;
    }
    var slugs = order.length ? order.slice() : wo ? Object.keys(wo) : [];
    for (i = 0; i < slugs.length; i++) {
      var slug = String(slugs[i] || "").trim().toLowerCase();
      if (!slug || seen[slug]) continue;
      var pct = eternalMachinePctForSlug(slug, wo, existingBySlug);
      if (pct == null) continue;
      seen[slug] = true;
      var prev = existingBySlug[slug];
      out.push({
        slug: slug,
        name: prev && prev.name ? String(prev.name) : eternalMachineTypeNameForSlug(slug),
        pct: pct,
      });
    }
    for (i = 0; i < existing.length; i++) {
      var row = existing[i];
      if (!row || !row.slug) continue;
      var sk2 = String(row.slug).trim().toLowerCase();
      if (seen[sk2]) continue;
      var p2 = eternalMachineParseTypePct(row.pct);
      if (p2 == null) continue;
      seen[sk2] = true;
      out.push({
        slug: sk2,
        name: String(row.name || eternalMachineTypeNameForSlug(sk2)),
        pct: p2,
      });
    }
    var catalogTypes = getIncomeMutationTypes();
    for (i = 0; i < catalogTypes.length; i++) {
      var t = catalogTypes[i];
      if (!t || !t.slug) continue;
      var sk3 = String(t.slug).trim().toLowerCase();
      if (seen[sk3]) continue;
      seen[sk3] = true;
      out.push({ slug: sk3, name: String(t.name || sk3), pct: 0 });
    }
    return out;
  }

  function eternalMachineDisplayedTypeRatesForTier(tierRow) {
    var baseRows = eternalMachineTypeRatesRows();
    if (!baseRows.length) return [];
    var slotRatios = eternalMachineSlottedBaseIncomeRatios();
    var bySlug = Object.create(null);
    var i;
    for (i = 0; i < baseRows.length; i++) {
      var row0 = baseRows[i];
      var slug0 = String(row0.slug || "").toLowerCase();
      bySlug[slug0] = Math.max(0, Number(row0.pct) || 0) * 0.25;
    }
    var extraRows = [];
    if (slotRatios.length) {
      for (i = 0; i < slotRatios.length; i++) {
        var slot = slotRatios[i];
        var slug = String(slot.typeSlug || "default").toLowerCase();
        bySlug[slug] = (bySlug[slug] || 0) + slot.ratio * 75;
        if (!eternalMachineRowsHaveSlug(baseRows, slug)) {
          extraRows.push({
            slug: slug,
            name: eternalMachineTypeNameForSlug(slug),
            pct: 0,
          });
        }
      }
    }
    var rows = baseRows.concat(extraRows).map(function (r) {
      var slug = String(r.slug || "").toLowerCase();
      return {
        slug: slug,
        name: r.name,
        pct: bySlug[slug] || 0,
      };
    });
    var sum = 0;
    for (i = 0; i < rows.length; i++) {
      sum += rows[i].pct;
    }
    if (sum > 0) {
      for (i = 0; i < rows.length; i++) {
        rows[i].pct = Math.round((rows[i].pct / sum) * 1000) / 10;
      }
    }
    return rows
      .filter(function (r) {
        return r.pct > 0.0005;
      })
      .sort(function (a, b) {
        return b.pct - a.pct;
      });
  }

  function eternalMachineRowsHaveSlug(rows, slug) {
    var i;
    for (i = 0; i < rows.length; i++) {
      if (String(rows[i].slug || "").toLowerCase() === slug) return true;
    }
    return false;
  }

  function eternalMachineRoundChancePct(x) {
    if (!(x > 0)) return "0";
    var r = Math.round(x * 10) / 10;
    return String(r);
  }

  function eternalMachineTypeRatesHtml(tierRow) {
    var rows = eternalMachineDisplayedTypeRatesForTier(tierRow);
    if (!rows.length) return "";
    return (
      '<div class="em-subrates">' +
      '<p class="em-outcomes-title">Possible Type Rates</p>' +
      '<ul class="em-subrates-list">' +
      rows
        .filter(function (r) {
          return r.pct > 0;
        })
        .map(function (r) {
          return "<li><span>" + escapeHtml(r.name) + "</span> <strong>" + escapeHtml(String(r.pct)) + "%</strong></li>";
        })
        .join("") +
      "</ul></div>"
    );
  }

  function eternalMachineTraitRatesHtml() {
    var slotRatios = eternalMachineSlottedBaseIncomeRatios();
    if (!slotRatios.length) return "";
    var byTrait = {};
    var i;
    for (i = 0; i < slotRatios.length; i++) {
      var slot = slotRatios[i];
      var traits = Array.isArray(slot.traits) ? slot.traits : [];
      var j;
      for (j = 0; j < traits.length; j++) {
        var traitName = String(traits[j] || "").trim();
        if (!traitName) continue;
        byTrait[traitName] = (byTrait[traitName] || 0) + slot.ratio * 75;
      }
    }
    var rowsArr = Object.keys(byTrait)
      .map(function (name) {
        return { name: name, pct: byTrait[name] || 0 };
      })
      .filter(function (row) {
        return row.pct > 0;
      })
      .sort(function (a, b) {
        return b.pct - a.pct;
      });
    if (!rowsArr.length) return "";
    var items = rowsArr
      .map(function (row) {
        var lab = String(row.name).replace(/\*+$/, "");
        return (
          "<li>" +
          '<span class="em-subrates-trait">' +
          traitThumbHtml(row.name) +
          "<span>" +
          escapeHtml(lab) +
          "</span></span> <strong>" +
          escapeHtml(eternalMachineRoundChancePct(row.pct)) +
          "%</strong></li>"
        );
      })
      .join("");
    return (
      '<div class="em-subrates">' +
      '<p class="em-outcomes-title">Possible Trait Chances</p>' +
      '<ul class="em-subrates-list em-subrates-list--traits">' +
      items +
      "</ul></div>"
    );
  }

  function eternalMachineFormatDisplayPct(pct) {
    if (!(pct > 0)) return "0";
    var r1 = Math.round(pct * 10) / 10;
    if (r1 > 0) {
      if (Math.abs(r1 - Math.round(r1)) < 1e-6) return String(Math.round(r1));
      return String(r1);
    }
    var r2 = Math.round(pct * 100) / 100;
    if (r2 > 0) return String(r2);
    return "<0.01";
  }

  function eternalMachineOutcomeGroupCardHtml(candidates, pct) {
    var items = (candidates || []).filter(Boolean);
    if (!items.length) return "";
    var membersHtml = items
      .map(function (b) {
        var nm = String((b && b.name) || "Unknown");
        return (
          '<span class="em-outcome-gcard-item"><span class="em-outcome-gcard-name">' +
          escapeHtml(nm) +
          '</span><span class="em-outcome-gcard-thumb brainrot-thumb">' +
          brainrotThumbMediaHtml(nm, b, "default", {}) +
          "</span></span>"
        );
      })
      .join("");
    return (
      '<li class="em-outcome-gcard"><span class="em-outcome-gcard-members">' +
      membersHtml +
      '</span><strong class="em-outcome-gcard-rate">' +
      escapeHtml(eternalMachineFormatDisplayPct(pct)) +
      "%</strong></li>"
    );
  }

  function eternalMachineTypeRatesRows() {
    return eternalMachineBuildUnifiedTypeRates()
      .map(function (r) {
        if (!r || !r.slug) return null;
        var pct = typeof r.pct === "number" && r.pct === r.pct ? r.pct : 0;
        return { slug: String(r.slug), name: String(r.name || r.slug), pct: Math.max(0, pct) };
      })
      .filter(Boolean);
  }

  function eternalMachineSyncReferenceTypeRates() {
    if (!ETERNAL_MACHINE_REFERENCE) return;
    var rows = eternalMachineTypeRatesRows();
    if (!rows.length) return;
    ETERNAL_MACHINE_REFERENCE.typeRates = rows.map(function (r) {
      return { name: r.name, slug: r.slug, pct: r.pct };
    });
  }

  function eternalMachineSortTypeRatesBySpawnOrder(rows) {
    var spawn = TYPE_SPAWN_EVENT_TABLES;
    var order = spawn && Array.isArray(spawn.typeOrder) ? spawn.typeOrder : [];
    if (!order.length || !rows.length) return rows;
    var rank = Object.create(null);
    var i;
    for (i = 0; i < order.length; i++) {
      rank[String(order[i] || "").trim().toLowerCase()] = i;
    }
    return rows.slice().sort(function (a, b) {
      var ra = rank[String(a.slug || "").toLowerCase()];
      var rb = rank[String(b.slug || "").toLowerCase()];
      var ia = ra === ra ? ra : 9999;
      var ib = rb === rb ? rb : 9999;
      if (ia !== ib) return ia - ib;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function eternalMachineRefreshReferenceTypeGrid() {
    var grid = document.querySelector("#em-reference .em-ref-type-grid");
    if (!grid) return;
    eternalMachineSyncReferenceTypeRates();
    var rows = eternalMachineSortTypeRatesBySpawnOrder(eternalMachineTypeRatesRows());
    if (!rows.length) return;
    grid.innerHTML = rows
      .map(function (r) {
        var pct = typeof r.pct === "number" && r.pct === r.pct ? r.pct : Number(r.pct);
        var pctStr = pct === pct ? String(pct) : String(r.pct);
        return (
          '<div class="em-ref-type-cell">' +
          '<span class="em-ref-type-cell__name">' +
          escapeHtml(r.name) +
          '</span><span class="em-ref-type-cell__pct"><strong>' +
          escapeHtml(pctStr) +
          "%</strong></span></div>"
        );
      })
      .join("");
  }

  function eternalMachineWeightedPickRows(rows, getWeight) {
    if (!rows || !rows.length) return null;
    var sum = 0;
    var i;
    for (i = 0; i < rows.length; i++) {
      var w = Number(getWeight(rows[i], i));
      if (w === w && w > 0) sum += w;
    }
    if (sum <= 0) return null;
    var r = Math.random() * sum;
    for (i = 0; i < rows.length; i++) {
      w = Number(getWeight(rows[i], i));
      if (!(w === w && w > 0)) continue;
      r -= w;
      if (r <= 0) return rows[i];
    }
    return rows[rows.length - 1];
  }

  /**
   * Machine tier / L use **total** = sum of catalog base `incomePerSec` only (no type or trait multipliers).
   * `effective` kept for reference only (older Verse-style); do not use for tier table lookup.
   */
  function eternalMachineCalculateScore(slottedValues) {
    var total = 0;
    var highest = 0;
    var i;
    for (i = 0; i < slottedValues.length; i++) {
      var row = slottedValues[i];
      var v =
        typeof row === "number" && row === row
          ? row
          : row && typeof row.incomePerSec === "number" && row.incomePerSec === row.incomePerSec
            ? row.incomePerSec
            : 0;
      total += v;
      if (v > highest) highest = v;
    }
    var effective = total + highest * 0.25;
    var level = Math.max(1, Math.floor(Math.log10(Math.max(1, total)) * 3));
    return { total: total, highest: highest, effective: effective, level: level };
  }

  function eternalMachineBuildChanceGroups(row) {
    var cols = (ETERNAL_MACHINE_RATES && ETERNAL_MACHINE_RATES.columns) || [];
    var wts = (row && row.weights) || [];
    var out = [];
    var i;
    for (i = 0; i < cols.length; i++) {
      var w = typeof wts[i] === "number" && wts[i] === wts[i] ? Math.max(0, wts[i]) : 0;
      if (w <= 0) continue;
      out.push({ colIndex: i, colName: String(cols[i]), weight: w });
    }
    return out;
  }

  function eternalMachineApplySpecialChanceRules(groups, slottedBrainrots, usePremiumRates) {
    if (!groups || !groups.length) return groups || [];
    var ref = ETERNAL_MACHINE_REFERENCE;
    if (!ref || !Array.isArray(ref.specials) || !ref.specials.length) return groups;
    var names = slottedBrainrots.map(function (b) {
      return String((b && b.name) || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
    });
    var slugs = slottedBrainrots.map(function (b) {
      return String((b && b.slug) || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
    });
    var laSuperiorSpecialTargets = {
      beariniplamminiguardini: true,
      garbagzilla: true,
      tiramisubmarini: true,
      cannellonidragoni: true,
    };
    var laSuperiorSeen = {};
    var laSuperiorDistinct = 0;
    var j;
    for (j = 0; j < names.length; j++) {
      var nn = names[j];
      if (!laSuperiorSpecialTargets[nn] || laSuperiorSeen[nn]) continue;
      laSuperiorSeen[nn] = true;
      laSuperiorDistinct++;
    }
    var hasTwo67 = slugs.filter(function (slug) {
      return slug === "67";
    }).length >= 2;
    var hasChimpanziniKingini = names.indexOf("chimpanzinikingini") >= 0;
    var targetLaSuperiorPct = 0;
    if (laSuperiorDistinct >= 2) {
      targetLaSuperiorPct = usePremiumRates ? 0.03 : 0.02;
    }
    if (!(targetLaSuperiorPct > 0)) {
      return groups.map(function (g) {
        var outColName = g.colName;
        if (hasTwo67 && outColName === "Nooo My Bicicleteira") outColName = "Los 67";
        if (hasChimpanziniKingini && outColName === "group D") outColName = "Los Chimpanzini Princinis";
        return { colIndex: g.colIndex, colName: outColName, weight: g.weight };
      });
    }
    var othersSum = 0;
    var i;
    for (i = 0; i < groups.length; i++) {
      var g0 = groups[i];
      if (!g0 || g0.colName === "La Superior Combinacion") continue;
      var w0 = Number(g0.weight) || 0;
      if (w0 > 0) othersSum += w0;
    }
    var laSuperiorWeight = othersSum > 0 ? (targetLaSuperiorPct * othersSum) / (1 - targetLaSuperiorPct) : 0;
    return groups.map(function (g) {
      var outColName = g.colName;
      if (hasTwo67 && outColName === "Nooo My Bicicleteira") outColName = "Los 67";
      if (hasChimpanziniKingini && outColName === "group D") outColName = "Los Chimpanzini Princinis";
      var w = outColName === "La Superior Combinacion" ? laSuperiorWeight : g.weight;
      return { colIndex: g.colIndex, colName: outColName, weight: w };
    });
  }

  function eternalMachineResolveGroupColumn(colName) {
    var ref = ETERNAL_MACHINE_REFERENCE;
    if (!ref || !Array.isArray(ref.machineGroups)) return colName;
    var i;
    for (i = 0; i < ref.machineGroups.length; i++) {
      var g = ref.machineGroups[i];
      if (!g || String(g.label || "") !== String(colName || "")) continue;
      var members = Array.isArray(g.members) ? g.members.filter(Boolean) : [];
      if (!members.length) return colName;
      return members[Math.floor(Math.random() * members.length)];
    }
    return colName;
  }

  function eternalMachineTypeAllowed(slug) {
    var s = String(slug || "").trim().toLowerCase();
    if (!s || s === "default") return true;
    return s !== "admin" && s !== "luckyrot" && s !== "luckyrots";
  }

  function eternalMachineTypeLabelForSlot(b, typeSlug) {
    var ts = String(typeSlug || "default").trim().toLowerCase();
    if (!ts) ts = "default";
    var typeRow = findBrainrotType(b, ts);
    if (typeRow && typeRow.name) return String(typeRow.name);
    var rows = eternalMachineTypeRatesRows();
    var i;
    for (i = 0; i < rows.length; i++) {
      if (String(rows[i].slug || "").toLowerCase() === ts) return String(rows[i].name || rows[i].slug || ts);
    }
    if (ts === "default") return "Default";
    return ts
      .split("-")
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function eternalMachineClosePicker() {
    eternalMachineUi.pickerSlot = null;
    eternalMachineUi.pickerSelectedSlug = null;
    eternalMachineUi.pickerDraft = { typeSlug: "default", traits: [] };
    eternalMachineSetPickerBodyMode(false);
    var ov = $("#em-picker-overlay");
    if (ov) ov.hidden = true;
    if (document && document.body) document.body.classList.remove("eternal-machine-picker-open");
    var title = $("#em-picker-title");
    if (title) title.textContent = "Pick a brainrot";
  }

  function eternalMachineTypesForPicker(b) {
    if (!b) return [{ slug: "default", name: "Default", multiplier: 1 }];
    var rows =
      Array.isArray(b.types) && b.types.length
        ? sortTypeRowsByMultiplierAsc(b.types.slice()).filter(function (t) {
            return t && eternalMachineTypeAllowed(t.slug);
          })
        : [];
    if (!rows.length) return [{ slug: "default", name: "Default", multiplier: 1 }];
    return rows;
  }

  function eternalMachineSetPickerBodyMode(configure) {
    var body = $("#em-picker-body");
    var colConf = $("#em-picker-col-configure");
    var colList = $("#em-picker-col-list");
    var pickerShell = document.querySelector(".eternal-machine .em-picker");
    if (body) body.classList.toggle("em-picker-body--configure", !!configure);
    if (pickerShell) pickerShell.classList.toggle("em-picker--configure", !!configure);
    if (colConf) colConf.hidden = !configure;
    if (colList) colList.classList.toggle("em-picker-col--dimmed", !!configure);
  }

  function eternalMachineRenderPickerPreview(b) {
    var prev = $("#em-picker-preview");
    if (!prev || !b) return;
    var slug = eternalMachineUi.pickerDraft.typeSlug || "default";
    var rbPv = slug === "rainbow" ? " em-thumb-rainbow" : "";
    prev.innerHTML =
      '<div class="em-picker-preview-inner">' +
      '<div class="em-picker-preview-iconcol">' +
      '<div class="em-picker-preview-thumb brainrot-thumb' +
      rbPv +
      '">' +
      brainrotThumbMediaHtml(b.name, b, slug, {
        imgClass: "brainrot-thumb__img em-picker-preview-img",
        fallbackClass: "brainrot-thumb__fallback em-picker-preview-fallback",
      }) +
      "</div>" +
      '<span class="em-picker-preview-income">' +
      escapeHtml(formatIncomePerSec(b.incomePerSec)) +
      "/s</span></div>" +
      '<div class="em-picker-preview-meta"><strong>' +
      escapeHtml(b.name) +
      "</strong>" +
      '<span class="muted">' +
      escapeHtml(formatRarityLabel(b.rarity)) +
      "</span></div></div>";
    hydrateBrainrotAtlasProbes(prev);
  }

  function eternalMachineRenderPickerConfigure(b) {
    eternalMachineRenderPickerPreview(b);
    var typesEl = $("#em-picker-types");
    var traitsEl = $("#em-picker-traits");
    if (!typesEl || !traitsEl) return;
    var typeRows = eternalMachineTypesForPicker(b);
    var cur = eternalMachineUi.pickerDraft.typeSlug || "default";
    typesEl.innerHTML = typeRows
      .map(function (t) {
        var slug = t.slug || "default";
        var active = slug === cur ? " is-active" : "";
        return (
          '<button type="button" class="em-type-chip' +
          active +
          '" data-type-slug="' +
          escapeHtml(slug) +
          '" title="' +
          escapeHtml(t.name || slug) +
          '">' +
          '<span class="em-type-chip__thumb brainrot-thumb">' +
          brainrotThumbMediaHtml(b.name, b, slug, {}) +
          '</span><span class="em-type-chip__lbl">' +
          escapeHtml(t.name || slug) +
          "</span></button>"
        );
      })
      .join("");
    var traitRows = (TRAITS_PAYLOAD && TRAITS_PAYLOAD.rows) || [];
    var picked = eternalMachineUi.pickerDraft.traits || [];
    traitsEl.innerHTML = traitRows
      .map(function (row) {
        var n = row && row.name ? String(row.name) : "";
        if (!n) return "";
        var on = picked.indexOf(n) >= 0;
        return (
          '<label class="em-trait-chip' +
          (on ? " is-active" : "") +
          '">' +
          '<input type="checkbox" class="em-trait-chip__cb" data-trait-name="' +
          escapeHtml(n) +
          '"' +
          (on ? " checked" : "") +
          " />" +
          traitThumbHtml(n) +
          '<span class="em-trait-chip__lbl">' +
          escapeHtml(n.replace(/\*+$/, "")) +
          "</span></label>"
        );
      })
      .join("");
    hydrateBrainrotAtlasProbes(typesEl);
    hydrateBrainrotAtlasProbes(traitsEl);
  }

  function eternalMachinePickerRarityKeys() {
    var mi = rarityOrderIndex("Mythic");
    return RARITY_ORDER.filter(function (r) {
      if (r === "Goat") return false;
      if (r === "LuckyRot" || r === "Admin") return false;
      var ri = rarityOrderIndex(r);
      return ri !== 999 && ri >= mi;
    });
  }

  function eternalMachinePickerBrainrotHasTypeSlug(b, slug) {
    if (!slug || slug === "all") return true;
    if (!eternalMachineTypeAllowed(slug)) return false;
    var types = b.types || [];
    var i;
    for (i = 0; i < types.length; i++) {
      if (types[i] && eternalMachineTypeAllowed(types[i].slug) && types[i].slug === slug) return true;
    }
    return false;
  }

  function eternalMachineBuildPickerTypeFilterOptions() {
    var cat = BRAINROT_TYPES_CATALOG;
    var rows = cat && Array.isArray(cat.types) ? cat.types : [];
    var used = {};
    var j;
    for (j = 0; j < BRAINROTS.length; j++) {
      var b = BRAINROTS[j];
      if (!b || !eternalMachineSlotRarityOk(b)) continue;
      var types = b.types || [];
      var k;
      for (k = 0; k < types.length; k++) {
        if (types[k] && types[k].slug && eternalMachineTypeAllowed(types[k].slug)) {
          used[types[k].slug] = true;
        }
      }
    }
    var opts = ['<option value="all">All types</option>'];
    for (j = 0; j < rows.length; j++) {
      var t = rows[j];
      if (t && !eternalMachineTypeAllowed(t.slug)) continue;
      if (!t || !t.slug || !used[t.slug]) continue;
      opts.push(
        '<option value="' +
          escapeHtml(t.slug) +
          '">' +
          escapeHtml(t.name || t.slug) +
          "</option>"
      );
    }
    return opts.join("");
  }

  function eternalMachineFillPickerList(q) {
    var list = $("#em-picker-list");
    if (!list || !BRAINROTS.length) return;
    var lower = String(q || "").trim().toLowerCase();
    var fr = $("#em-picker-filter-rarity");
    var ft = $("#em-picker-filter-type");
    var rarityKey = fr && fr.value ? String(fr.value) : "all";
    var typeSlug = ft && ft.value ? String(ft.value) : "all";
    var filtered = BRAINROTS.filter(function (b) {
      if (!eternalMachineSlotRarityOk(b)) return false;
      if (rarityKey !== "all" && canonicalRarityBucketKey(b.rarity) !== rarityKey) return false;
      if (!eternalMachinePickerBrainrotHasTypeSlug(b, typeSlug)) return false;
      if (!lower) return true;
      return (
        String(b.name).toLowerCase().indexOf(lower) !== -1 ||
        String(b.slug).toLowerCase().indexOf(lower) !== -1 ||
        String(b.id) === lower
      );
    });
    var pool;
    if (lower) {
      pool = filtered.slice(0, 100);
    } else {
      pool = filtered
        .slice()
        .sort(function (a, b) {
          var ia =
            typeof a.incomePerSec === "number" && a.incomePerSec === a.incomePerSec ? a.incomePerSec : 0;
          var ib =
            typeof b.incomePerSec === "number" && b.incomePerSec === b.incomePerSec ? b.incomePerSec : 0;
          if (ib !== ia) return ib - ia;
          return String(a.name || "").localeCompare(String(b.name || ""));
        })
        .slice(0, 80);
    }
    list.innerHTML = pool
      .map(function (b) {
        return (
          '<button type="button" class="em-picker-row" data-slug="' +
          escapeHtml(b.slug) +
          '"><span class="em-picker-thumb brainrot-thumb">' +
          brainrotThumbMediaHtml(b.name, b, "default", {}) +
          '</span><span class="em-picker-meta"><span class="em-picker-name">' +
          escapeHtml(b.name) +
          '</span><span class="em-picker-sub">' +
          escapeHtml(formatRarityLabel(b.rarity)) +
          " · " +
          escapeHtml(formatIncomePerSec(b.incomePerSec)) +
          "/s</span></span></button>"
        );
      })
      .join("");
    hydrateBrainrotAtlasProbes(list);
  }

  function eternalMachineSlotTraitsHtml(names, opts) {
    if (!names || !names.length) return "";
    var rows = names.map(function (n) {
      return (
        '<span class="em-slot-trait-inline" title="' +
        escapeHtml(n) +
        '">' +
        traitThumbHtml(n, opts) +
        "</span>"
      );
    });
    return '<span class="em-slot-traits-inline">' + rows.join("") + "</span>";
  }

  function eternalMachineRefreshSlotsAndMeta() {
    var i;
    var total = 0;
    for (i = 0; i < eternalMachineUi.slots.length; i++) {
      var saved = eternalMachineUi.slots[i];
      var b = eternalMachineResolveSlotB(saved);
      var st = eternalMachineNormalizeSlot(saved);
      if (b && st && !eternalMachineSlotRarityOk(b)) {
        eternalMachineUi.slots[i] = null;
        b = null;
        st = null;
      }
      var cell = document.querySelector('.em-slot[data-slot="' + i + '"]');
      if (!cell) continue;
      if (b && st) {
        var slotIncome = Number(b.incomePerSec) || 0;
        total += slotIncome;
        var ts = st.typeSlug || "default";
        var rbThumb = ts === "rainbow" ? " em-thumb-rainbow" : "";
        cell.innerHTML =
          '<span class="em-slot-fill">' +
          '<span class="em-slot-main">' +
          '<span class="em-slot-center">' +
          '<span class="em-slot-thumb brainrot-thumb' +
          rbThumb +
          '">' +
          brainrotThumbMediaHtml(b.name, b, ts, {}) +
          "</span>" +
          '<span class="em-slot-income">' +
          escapeHtml(formatIncomePerSec(slotIncome)) +
          "</span>" +
          "</span>" +
          "</span>" +
          '<span class="em-slot-text">' +
          "<strong>" +
          escapeHtml(b.name) +
          "</strong>" +
          '<span class="em-slot-meta">' +
          escapeHtml(formatRarityLabel(b.rarity)) +
          '</span><span class="em-slot-mutation" data-mutation="' +
          escapeAttr(ts) +
          '">' +
          escapeHtml(eternalMachineTypeLabelForSlot(b, ts)) +
          "</span>" +
          eternalMachineSlotTraitsHtml(st.traits) +
          "</span>" +
          '<span class="em-slot-x" data-clear-slot="' +
          i +
          '" title="' +
          escapeAttr(translationTx("eternalMachinePage.slotRemoveTitle", "Remove from slot")) +
          '">×</span>' +
          "</span>";
      } else {
        cell.innerHTML =
          '<span class="em-slot-empty"><span class="em-slot-plus">+</span><span>' +
          escapeHtml(translationTx("eternalMachinePage.slotAddBrainrot", "Add brainrot")) +
          "</span></span>";
      }
    }
    hydrateBrainrotAtlasProbes($("#em-slots"));
    var sumEl = $("#em-sum-income");
    if (sumEl) {
      sumEl.textContent = total > 0 ? formatIncomePerSec(total) : "—";
    }
    var scorePreview = eternalMachineCalculateScore(
      eternalMachineUi.slots
        .map(function (s) {
          var bPrev = eternalMachineResolveSlotB(s);
          return bPrev ? Number(bPrev.incomePerSec) || 0 : 0;
        })
        .filter(function (v) {
          return typeof v === "number" && v > 0;
        })
    );
    var tierRow = eternalMachineResolveTierRow(scorePreview.total);
    var tierEl = $("#em-tier");
    if (tierEl) {
      if (total <= 0) tierEl.textContent = "—";
      else if (tierRow) {
        tierEl.textContent = "Tier " + tierRow.tier;
      } else tierEl.textContent = "Below sheet range";
    }
    var outWrap = $("#em-outcomes");
    var emTypeRates = eternalMachineTypeRatesHtml(tierRow || null);
    var emTraitRates = eternalMachineTraitRatesHtml();
    var emSubRatesHtml =
      emTypeRates && emTraitRates
        ? '<div class="em-subrates-row">' + emTypeRates + emTraitRates + "</div>"
        : emTypeRates + emTraitRates;
    if (outWrap && ETERNAL_MACHINE_RATES) {
      if (tierRow) {
        var filledForPreview = eternalMachineUi.slots
          .map(function (s) {
            return eternalMachineResolveSlotB(s);
          })
          .filter(function (bx) {
            return bx && eternalMachineSlotRarityOk(bx);
          });
        var groupsPreview = eternalMachineApplySpecialChanceRules(eternalMachineBuildChanceGroups(tierRow), filledForPreview, eternalMachineUi.usePremiumRates);
        var sumPreview = groupsPreview.reduce(function (acc, g) {
          return acc + (g && g.weight > 0 ? g.weight : 0);
        }, 0);
        var parts = [];
        for (i = 0; i < groupsPreview.length; i++) {
          var gPrev = groupsPreview[i];
          if (!gPrev || !(gPrev.weight > 0)) continue;
          var pct = sumPreview > 0 ? (gPrev.weight / sumPreview) * 100 : 0;
          if (pct <= 0) continue;
          var candidates = eternalMachineResolveColumnCandidates(String(gPrev.colName));
          if (!candidates.length) continue;
          parts.push(eternalMachineOutcomeGroupCardHtml(candidates, pct));
        }
        outWrap.innerHTML =
          '<p class="em-outcomes-title">Possible outcomes</p><ul class="em-outcomes-list">' +
          parts.join("") +
          "</ul>" +
          emSubRatesHtml;
        hydrateBrainrotAtlasProbes(outWrap);
      } else {
        outWrap.innerHTML =
          (total > 0
            ? '<p class="empty-state em-outcomes-tier-miss">No tier on the machine-rates sheet for this base income — see <a href="#" class="em-outcomes-ref-link" data-em-open-ref="1">sheet reference</a>.</p>'
            : "") +
          emSubRatesHtml;
        hydrateBrainrotAtlasProbes(outWrap);
        var refL = outWrap.querySelector("[data-em-open-ref]");
        if (refL) {
          refL.addEventListener("click", function (e) {
            e.preventDefault();
            eternalMachineRevealReference();
            var refEl = $("#em-reference");
            if (refEl && typeof refEl.scrollIntoView === "function") {
              try {
                refEl.scrollIntoView({ block: "start" });
              } catch (eScroll) {}
            }
          });
        }
      }
    }
    eternalMachineCloseFuseModal();
    var fuseBtn = $("#em-fuse");
    if (fuseBtn) {
      var filledCount = 0;
      for (var fi = 0; fi < eternalMachineUi.slots.length; fi++) {
        var bf = eternalMachineResolveSlotB(eternalMachineUi.slots[fi]);
        if (bf && eternalMachineSlotRarityOk(bf)) filledCount++;
      }
      fuseBtn.disabled = filledCount < 5;
      fuseBtn.setAttribute("aria-disabled", filledCount < 5 ? "true" : "false");
      fuseBtn.title =
        filledCount < 5
          ? translationTx("eternalMachinePage.fuseTitleDisabled", "Fill all 5 Mythic+ slots to enable fuse.")
          : translationTx("eternalMachinePage.fuseTitleEnabled", "Roll once using the current sheet weights.");
    }
    var premSync = $("#em-premium-rates");
    var premCard = $("#em-premium-card");
    var premPill = $("#em-premium-pill");
    if (premSync) {
      premSync.disabled = !eternalMachinePremiumRatesAvailable();
      if (premSync.disabled) {
        eternalMachineUi.usePremiumRates = false;
        premSync.checked = false;
        try {
          sessionStorage.removeItem("emPremiumRates");
        } catch (ePremSyncRm) {}
      } else {
        premSync.checked = !!eternalMachineUi.usePremiumRates;
      }
    }
    if (premCard) {
      premCard.setAttribute("data-sheet", eternalMachineUi.usePremiumRates ? "premium" : "normal");
      premCard.classList.toggle("em-premium-card--disabled", premSync ? premSync.disabled : true);
    }
    if (premPill) {
      premPill.textContent = eternalMachineUi.usePremiumRates
        ? translationTx("eternalMachinePage.premiumPremium", "PREMIUM")
        : translationTx("eternalMachinePage.premiumNormal", "NORMAL");
    }
  }

  function eternalMachineFuseApiMessage(data) {
    var e = data && data.error;
    if (e === "score_too_low") return translationTx("eternalMachinePage.fuseApiScoreLow", "Machine score is too low for a tier.");
    if (e === "no_positive_groups") return translationTx("eternalMachinePage.fuseApiNoGroups", "No positive chance groups for this tier.");
    if (e === "need_five_slots" || e === "invalid_slot_slug")
      return translationTx("eternalMachinePage.fuseApiNeedFive", "Fill all 5 slots with valid brainrots.");
    if (e === "unknown_slug" || e === "unknown_id")
      return translationTx("eternalMachinePage.fuseApiUnknownSlug", "Could not load one or more slotted brainrots from the catalog.");
    if (e === "rarity_not_allowed")
      return translationTx("eternalMachinePage.fuseApiRarityBad", "One or more slots use a brainrot that cannot be fused (e.g. Goat rarity).");
    if (e === "bad_response" || e === "invalid_json")
      return translationTx("eternalMachinePage.fuseApiBadResponse", "Fuse API returned an invalid response.");
    if (e === "catalog_missing") return translationTx("eternalMachinePage.fuseApiCatalogMissing", "Fuse API is misconfigured (missing catalog data).");
    return e ? String(e) : translationTx("eternalMachinePage.fuseApiFailed", "Fuse failed.");
  }

  function eternalMachineRestoreFuseButtonState() {
    var fuseBtn = $("#em-fuse");
    if (!fuseBtn) return;
    var filledCount = 0;
    var fi;
    for (fi = 0; fi < eternalMachineUi.slots.length; fi++) {
      var bf = eternalMachineResolveSlotB(eternalMachineUi.slots[fi]);
      if (bf && eternalMachineSlotRarityOk(bf)) filledCount++;
    }
    fuseBtn.disabled = filledCount < 5;
    fuseBtn.setAttribute("aria-disabled", filledCount < 5 ? "true" : "false");
  }

  function eternalMachineOnFuse() {
    var st = $("#em-status");
    var fuseBtn = $("#em-fuse");
    var si;
    for (si = 0; si < eternalMachineUi.slots.length; si++) {
      if (!eternalMachineNormalizeSlot(eternalMachineUi.slots[si])) {
        if (st)
          st.textContent = translationTx(
            "eternalMachinePage.fuseErrFillMythic",
            "Fill all 5 slots with Mythic+ brainrots before fusing.",
          );
        return;
      }
      var bFuse = eternalMachineResolveSlotB(eternalMachineUi.slots[si]);
      if (!bFuse || !eternalMachineSlotRarityOk(bFuse)) {
        if (st)
          st.textContent = translationTx(
            "eternalMachinePage.fuseErrGoatSlot",
            "One or more slots use a brainrot that cannot be fused (e.g. Goat rarity).",
          );
        return;
      }
    }
    var filled = eternalMachineUi.slots
      .map(function (s) {
        return eternalMachineResolveSlotB(s);
      })
      .filter(function (bx) {
        return bx && eternalMachineSlotRarityOk(bx);
      });
    if (filled.length < 5) {
      if (st)
        st.textContent = translationTx(
          "eternalMachinePage.fuseErrCatalogLoad",
          "Could not load one or more slotted brainrots from the catalog.",
        );
      return;
    }
    var slotsPayload = eternalMachineUi.slots.map(function (s) {
      var stSlot = eternalMachineNormalizeSlot(s);
      var bSlot = eternalMachineResolveSlotB(s);
      var row = {
        typeSlug: stSlot.typeSlug || "default",
        traits: Array.isArray(stSlot.traits) ? stSlot.traits.slice() : [],
      };
      if (bSlot && typeof bSlot.id === "number" && bSlot.id === bSlot.id) row.id = bSlot.id;
      else row.slug = stSlot.slug;
      return row;
    });
    var api = siteApiUrl("api/eternal-machine-fuse");
    if (!api) {
      if (st)
        st.textContent = translationTx(
          "eternalMachinePage.fuseErrFile",
          "Fuse requires http(s) with the API (use npm start or the hosted site, not raw file://).",
        );
      return;
    }
    if (fuseBtn) fuseBtn.disabled = true;
    if (st) st.textContent = translationTx("eternalMachinePage.fuseRolling", "Rolling…");
    fetch(api, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usePremiumRates: !!eternalMachineUi.usePremiumRates,
        slots: slotsPayload,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: "bad_response" };
        });
      })
      .then(function (data) {
        eternalMachineRestoreFuseButtonState();
        if (!data || !data.ok) {
          if (st) st.textContent = eternalMachineFuseApiMessage(data);
          return;
        }
        if (st) st.textContent = "";
        var pct = data.pct;
        var colName = data.colName;
        var resolvedName = data.resolvedName;
        var wonApi = data.won;
        var fuseBody = $("#em-fuse-body");
        var fuseOv = $("#em-fuse-overlay");
        var fuseTitle = $("#em-fuse-title");
        if (!fuseBody || !fuseOv) return;
        var resolvedSuffix =
          resolvedName !== colName
            ? '</strong> <span class="em-fuse-kicker__resolved muted">(' +
              escapeHtml(translationTx("eternalMachinePage.fuseResolved", "resolved:")) +
              " " +
              escapeHtml(resolvedName) +
              ")</span><strong>"
            : "";
        var head =
          '<p class="em-fuse-kicker">' +
          escapeHtml(translationTx("eternalMachinePage.fuseYouRolled", "You rolled")) +
          " <strong>" +
          escapeHtml(String(pct)) +
          "%</strong> → <strong>" +
          escapeHtml(String(colName)) +
          resolvedSuffix +
          "</strong></p>";
        var wonFull = null;
        if (wonApi && (wonApi.slug || wonApi.id != null)) {
          var wi;
          var wonIdNum =
            wonApi.id != null && typeof wonApi.id === "number" && wonApi.id === wonApi.id
              ? wonApi.id
              : wonApi.id != null && String(wonApi.id).trim() !== ""
                ? Number(wonApi.id)
                : NaN;
          for (wi = 0; wi < BRAINROTS.length; wi++) {
            if (wonApi.slug && BRAINROTS[wi].slug === wonApi.slug) {
              wonFull = BRAINROTS[wi];
              break;
            }
            if (wonIdNum === wonIdNum && BRAINROTS[wi].id === wonIdNum) {
              wonFull = BRAINROTS[wi];
              break;
            }
          }
        }
        var won = wonFull && wonApi && typeof wonApi === "object" ? Object.assign({}, wonFull, wonApi) : wonFull || wonApi;
        var rolledType = (wonApi && wonApi.rolledType) || "default";
        var rolledTraits = (wonApi && Array.isArray(wonApi.rolledTraits) ? wonApi.rolledTraits : []) || [];
        if (fuseTitle)
          fuseTitle.textContent =
            won && won.name
              ? String(won.name)
              : translationTx("eternalMachinePage.fusionTitle", "Fusion result");
        if (won && won.slug) {
          var rbFuse = rolledType === "rainbow" ? " em-thumb-rainbow" : "";
          var fuseSnap = { slug: won.slug, typeSlug: rolledType, traits: rolledTraits };
          var fuseIncomeCalc = eternalMachineSlotIncome(fuseSnap, won);
          var fuseTypeLabel = escapeHtml(eternalMachineTypeLabelForSlot(won, rolledType));
          var fuseTraitsHtml =
            rolledTraits.length > 0
              ? '<div class="em-fuse-reward__traits">' +
                eternalMachineSlotTraitsHtml(rolledTraits, { loading: "eager" }) +
                "</div>"
              : "";
          fuseBody.innerHTML =
            head +
            '<div class="em-fuse-reward">' +
            '<div class="em-fuse-reward__thumb brainrot-thumb' +
            rbFuse +
            '">' +
            brainrotThumbMediaHtml(won.name, won, rolledType, { loading: "eager" }) +
            "</div>" +
            '<div class="em-fuse-reward__main">' +
            '<p class="em-fuse-reward__rarity ' +
            rarityBadgeClass(won.rarity) +
            '">' +
            escapeHtml(formatRarityLabel(won.rarity)) +
            "</p>" +
            '<h3 class="em-fuse-reward__name">' +
            escapeHtml(won.name) +
            "</h3>" +
            '<p class="em-fuse-reward__type" data-mutation="' +
            escapeAttr(rolledType) +
            '">' +
            fuseTypeLabel +
            "</p>" +
            '<p class="em-fuse-reward__income"><strong>' +
            escapeHtml(formatIncomePerSec(fuseIncomeCalc)) +
            "</strong></p>" +
            fuseTraitsHtml +
            '<div class="em-fuse-reward__actions">' +
            '<a class="btn-primary" data-spa-path="/brainrots/' +
            encodeURIComponent(won.slug) +
            '" href="' +
            escapeHtml(spaHref("/brainrots/" + encodeURIComponent(won.slug))) +
            '">' +
            escapeHtml(translationTx("eternalMachinePage.fuseOpenCatalog", "Open in catalog")) +
            "</a>" +
            '<button type="button" class="btn-secondary em-fuse-done">' +
            escapeHtml(translationTx("eternalMachinePage.fuseDone", "Done")) +
            "</button>" +
            "</div></div></div>";
          eternalMachineTryPlayFuseSound(won);
        } else {
          fuseBody.innerHTML =
            head +
            '<div class="em-fuse-plain">' +
            "<p>" +
            escapeHtml(
              translationTx(
                "eternalMachinePage.fuseGroupPoolPlain",
                "This column is a group / pool label in the sheet, not a single catalog brainrot.",
              ),
            ) +
            "</p>" +
            '<button type="button" class="btn-secondary em-fuse-done">' +
            escapeHtml(translationTx("eternalMachinePage.fuseModalClose", "Close")) +
            "</button>" +
            "</div>";
        }
        var pickOv = $("#em-picker-overlay");
        if (pickOv && !pickOv.hidden) {
          pickOv.hidden = true;
          if (document && document.body) document.body.classList.remove("eternal-machine-picker-open");
        }
        fuseOv.hidden = false;
        if (document && document.body) document.body.classList.add("eternal-machine-fuse-open");
        hydrateBrainrotAtlasProbes(fuseBody);
      })
      .catch(function () {
        eternalMachineRestoreFuseButtonState();
        if (st)
          st.textContent = translationTx(
            "eternalMachinePage.fuseErrNetwork",
            "Could not reach the fuse API (check server or connection).",
          );
      });
  }

  function eternalMachineRefGetActiveTierRows() {
    var ref = ETERNAL_MACHINE_REFERENCE;
    if (eternalMachineRefUi.usePremiumRates && ref && Array.isArray(ref.premiumTiers) && ref.premiumTiers.length) {
      return ref.premiumTiers;
    }
    var p = ETERNAL_MACHINE_RATES;
    return p && Array.isArray(p.tiers) ? p.tiers : [];
  }

  function eternalMachineRefSyncPremiumCard() {
    var card = $("#em-ref-premium-card");
    var cb = $("#em-ref-premium-rates");
    var pill = $("#em-ref-premium-pill");
    if (!card || !cb || !pill) return;
    var avail = eternalMachinePremiumRatesAvailable();
    cb.disabled = !avail;
    card.setAttribute("data-sheet", eternalMachineRefUi.usePremiumRates ? "premium" : "normal");
    card.classList.toggle("em-premium-card--disabled", !avail);
    if (!avail) {
      eternalMachineRefUi.usePremiumRates = false;
      cb.checked = false;
    } else {
      cb.checked = !!eternalMachineRefUi.usePremiumRates;
    }
    pill.textContent = eternalMachineRefUi.usePremiumRates
      ? translationTx("eternalMachinePage.premiumPremium", "PREMIUM")
      : translationTx("eternalMachinePage.premiumNormal", "NORMAL");
  }

  function eternalMachineRefRenderTierViewer() {
    var host = $("#em-ref-tier-view-host");
    var rail = $("#em-ref-tier-rail");
    if (!host) return;
    var cols = ETERNAL_MACHINE_RATES && ETERNAL_MACHINE_RATES.columns;
    var rows = eternalMachineRefGetActiveTierRows();
    if (!cols || !cols.length || !rows.length) {
      host.innerHTML = '<p class="muted">No tier rows for this sheet.</p>';
      if (rail) rail.innerHTML = "";
      eternalMachineRefSyncPremiumCard();
      return;
    }
    var maxi = rows.length - 1;
    var idx = eternalMachineRefUi.tierIndex;
    if (idx < 0) idx = 0;
    if (idx > maxi) idx = maxi;
    eternalMachineRefUi.tierIndex = idx;
    if (rail) {
      var ri;
      var railParts = [];
      for (ri = 0; ri < rows.length; ri++) {
        var tr = rows[ri];
        var tnum = tr && typeof tr.tier === "number" ? tr.tier : ri + 1;
        var minM = tr && typeof tr.minIncomeMs === "number" && tr.minIncomeMs === tr.minIncomeMs ? tr.minIncomeMs : 0;
        var active = ri === idx ? " is-active" : "";
        railParts.push(
          '<button type="button" class="em-ref-tier-pick' +
            active +
            '" data-ref-tier-idx="' +
            ri +
            '" title="Min income (M/s) &gt; ' +
            escapeHtml(String(minM)) +
            '">Tier ' +
            escapeHtml(String(tnum)) +
            "</button>"
        );
      }
      rail.innerHTML = railParts.join("");
      var act = rail.querySelector(".em-ref-tier-pick.is-active");
      if (act && typeof act.scrollIntoView === "function") {
        try {
          act.scrollIntoView({ block: "nearest", inline: "nearest" });
        } catch (eRailScroll) {}
      }
    }
    var tier = rows[idx];
    var wts = (tier.weights || []).slice();
    while (wts.length < cols.length) wts.push(0);
    var entries = [];
    var j;
    for (j = 0; j < cols.length; j++) {
      var pct = typeof wts[j] === "number" && wts[j] === wts[j] ? wts[j] : 0;
      if (pct > 0) entries.push({ name: String(cols[j]), pct: pct });
    }
    entries.sort(function (a, b) {
      return b.pct - a.pct;
    });
    var listHtml = entries.length
      ? entries
          .map(function (e) {
            var pRounded = Math.round(e.pct * 100) / 100;
            return (
              '<li class="em-ref-tier-out"><span class="em-ref-tier-out__name">' +
              escapeHtml(e.name) +
              '</span><span class="em-ref-tier-out__pct">' +
              escapeHtml(String(pRounded)) +
              "%</span></li>"
            );
          })
          .join("")
      : '<li class="em-ref-tier-out em-ref-tier-out--empty muted">No positive weights in this tier row.</li>';
    host.innerHTML =
      '<h3 class="em-ref-tier-title">Tier ' +
      escapeHtml(String(tier.tier)) +
      "</h3>" +
      '<p class="em-ref-tier-sub">&gt;' +
      escapeHtml(String(tier.minIncomeMs)) +
      " M/s required</p>" +
      '<ul class="em-ref-tier-outcomes">' +
      listHtml +
      "</ul>";
    eternalMachineRefSyncPremiumCard();
  }

  function eternalMachineWireRefTierBrowser(root) {
    if (!root || root.getAttribute("data-em-ref-tier-wire") === "1") return;
    root.setAttribute("data-em-ref-tier-wire", "1");
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var pick = t.closest("[data-ref-tier-idx]");
      if (pick && root.contains(pick)) {
        var ix = parseInt(pick.getAttribute("data-ref-tier-idx"), 10);
        if (ix === ix && ix >= 0) {
          eternalMachineRefUi.tierIndex = ix;
          eternalMachineRefRenderTierViewer();
        }
      }
    });
    var refCb = root.querySelector("#em-ref-premium-rates");
    if (refCb) {
      refCb.addEventListener("change", function () {
        if (!eternalMachinePremiumRatesAvailable()) {
          refCb.checked = false;
          eternalMachineRefUi.usePremiumRates = false;
          eternalMachineRefRenderTierViewer();
          return;
        }
        var rowsCur = eternalMachineRefGetActiveTierRows();
        var cur = rowsCur[eternalMachineRefUi.tierIndex];
        var tierNum = cur && typeof cur.tier === "number" ? cur.tier : null;
        eternalMachineRefUi.usePremiumRates = !!refCb.checked;
        var rowsNew = eternalMachineRefGetActiveTierRows();
        if (rowsNew.length) {
          if (tierNum != null) {
            var fi = -1;
            var i;
            for (i = 0; i < rowsNew.length; i++) {
              if (rowsNew[i].tier === tierNum) {
                fi = i;
                break;
              }
            }
            eternalMachineRefUi.tierIndex = fi >= 0 ? fi : Math.min(eternalMachineRefUi.tierIndex, rowsNew.length - 1);
          } else {
            eternalMachineRefUi.tierIndex = Math.min(eternalMachineRefUi.tierIndex, rowsNew.length - 1);
          }
        } else {
          eternalMachineRefUi.tierIndex = 0;
        }
        eternalMachineRefRenderTierViewer();
      });
    }
  }

  function eternalMachineMountReference(root) {
    var el = root.querySelector("#em-reference");
    if (!el || el.getAttribute("data-built") === "1") return;
    el.setAttribute("data-built", "1");
    var cols = ETERNAL_MACHINE_RATES && ETERNAL_MACHINE_RATES.columns;
    if (!cols || !cols.length) {
      el.innerHTML = '<p class="muted">Reference tables need machine rates data.</p>';
      return;
    }
    eternalMachineSyncReferenceTypeRates();
    var ref = ETERNAL_MACHINE_REFERENCE;
    var parts = [];
    if (ETERNAL_MACHINE_RATES.tiers && ETERNAL_MACHINE_RATES.tiers.length) {
      parts.push(
        '<div class="em-ref-tier-browser" id="em-ref-tier-browser">' +
        '<div class="em-ref-tier-browser__top">' +
        '<p class="em-ref-tier-browser__head">Machine rates by tier</p>' +
        '<div class="em-premium-card" id="em-ref-premium-card" data-sheet="normal">' +
        '<label class="em-premium-card__row" for="em-ref-premium-rates">' +
        '<span class="em-premium-switch">' +
        '<input type="checkbox" id="em-ref-premium-rates" class="em-premium-switch__input" />' +
        '<span class="em-premium-switch__track" aria-hidden="true"></span>' +
        "</span>" +
        '<span class="em-premium-card__head">' +
        '<span class="em-premium-card__title">Premium machine rates</span>' +
        '<span id="em-ref-premium-pill" class="em-premium-pill" aria-live="polite">NORMAL</span>' +
        "</span>" +
        "</label>" +
        "</div></div>" +
        '<div class="em-ref-tier-browser__body">' +
        '<nav class="em-ref-tier-rail" id="em-ref-tier-rail" aria-label="Select machine tier"></nav>' +
        '<div class="em-ref-tier-panel">' +
        '<div id="em-ref-tier-view-host" class="em-ref-tier-view-host"></div>' +
        "</div></div></div>"
      );
    }
    if (ref && Array.isArray(ref.machineGroups) && ref.machineGroups.length) {
      var ghtml = ref.machineGroups
        .map(function (g) {
          var mem = (g.members || []).map(function (m) {
            return "<li>" + escapeHtml(String(m)) + "</li>";
          });
          return (
            '<div class="em-ref-group"><h4>' +
            escapeHtml(g.label || g.id) +
            "</h4><ul>" +
            mem.join("") +
            "</ul></div>"
          );
        })
        .join("");
      var groupRuleHtml = ref.groupRule
        ? '<p class="em-ref-p em-ref-p--flush">' + escapeHtml(String(ref.groupRule)) + "</p>"
        : "";
      parts.push(
        '<section class="em-ref-block"><h3 class="em-ref-block__title">Machine groups</h3><div class="em-ref-block__body em-ref-block__body--groups">' +
          groupRuleHtml +
          '<div class="em-ref-groups">' +
          ghtml +
          "</div></div></section>"
      );
    } else if (ref && ref.groupRule) {
      parts.push(
        '<section class="em-ref-block"><h3 class="em-ref-block__title">Group rolls</h3><div class="em-ref-block__body"><p class="em-ref-p em-ref-p--flush">' +
          escapeHtml(String(ref.groupRule)) +
          "</p></div></section>"
      );
    }
    if (ref && Array.isArray(ref.specials) && ref.specials.length) {
      var shtml = ref.specials
        .map(function (s) {
          var rw = String(s.replaceWith || "").replace(/\s*\(same % bucket\)\s*$/i, "").trim();
          return (
            '<article class="em-ref-card"><h4 class="em-ref-card__title">' +
            escapeHtml(s.name) +
            "</h4><p class=\"em-ref-card__text\">" +
            escapeHtml(s.summary || "") +
            '</p><footer class="em-ref-card__ft"><span>Replaces</span> <em>' +
            escapeHtml(String(s.replacesColumn || "")) +
            '</em> <span class="em-ref-card__arrow" aria-hidden="true">→</span> <span class="em-ref-mono">' +
            escapeHtml(rw) +
            "</span></footer></article>"
          );
        })
        .join("");
      parts.push(
        '<section class="em-ref-block"><h3 class="em-ref-block__title">Special inputs</h3><div class="em-ref-block__body"><div class="em-ref-card-grid">' +
          shtml +
          "</div></div></section>"
      );
    }
    var unifiedTypeRates = eternalMachineSortTypeRatesBySpawnOrder(eternalMachineTypeRatesRows());
    if (unifiedTypeRates.length) {
      var typeCells = unifiedTypeRates
        .map(function (r) {
          var pct = typeof r.pct === "number" && r.pct === r.pct ? r.pct : Number(r.pct);
          var pctStr = pct === pct ? String(pct) : String(r.pct);
          return (
            '<div class="em-ref-type-cell">' +
            '<span class="em-ref-type-cell__name">' +
            escapeHtml(r.name) +
            '</span><span class="em-ref-type-cell__pct"><strong>' +
            escapeHtml(pctStr) +
            "%</strong></span></div>"
          );
        })
        .join("");
      var notesHtml = "";
      if (Array.isArray(ref.typeNotes) && ref.typeNotes.length) {
        notesHtml =
          '<ul class="em-ref-notes">' +
          ref.typeNotes
            .map(function (n) {
              return "<li>" + escapeHtml(String(n)) + "</li>";
            })
            .join("") +
          "</ul>";
      }
      parts.push(
        '<section class="em-ref-block"><h3 class="em-ref-block__title">Random mutation type %</h3><div class="em-ref-block__body em-ref-block__body--types">' +
          '<div class="em-ref-types-row">' +
          '<div class="em-ref-scroll em-ref-scroll--types">' +
          '<div class="em-ref-type-pack">' +
          '<div class="em-ref-type-grid-head">' +
          '<span class="em-ref-type-grid-head__lbl">Type</span>' +
          '<span class="em-ref-type-grid-head__pct">%</span></div>' +
          '<div class="em-ref-type-grid">' +
          typeCells +
          "</div></div></div>" +
          notesHtml +
          "</div></div></section>"
      );
    }
    el.innerHTML = '<div class="em-ref-inner">' + parts.join("") + "</div>";
    if ($("#em-ref-tier-browser")) {
      eternalMachineRefUi.tierIndex = 0;
      eternalMachineRefUi.usePremiumRates = false;
      eternalMachineRefRenderTierViewer();
      eternalMachineWireRefTierBrowser(root);
    }
  }

  function eternalMachineRefreshStaticLabels(root) {
    root = root || $("#eternal-machine-root");
    if (!root) return;
    function metaLine(strongId, key, fb) {
      var el = $("#" + strongId);
      if (!el || !el.parentElement) return;
      var v = el.textContent;
      el.parentElement.innerHTML =
        escapeHtml(translationTx(key, fb)) + ' <strong id="' + strongId + '">' + escapeHtml(v) + "</strong>";
    }
    metaLine("em-sum-income", "eternalMachinePage.totalIncome", "Total base income:");
    metaLine("em-tier", "eternalMachinePage.machineTier", "Machine tier:");
    var premTitle = root.querySelector(".em-premium-card__title");
    if (premTitle)
      premTitle.textContent = translationTx("eternalMachinePage.premiumTitle", "Premium machine rates");
    var fuseBtn = $("#em-fuse");
    if (fuseBtn) fuseBtn.textContent = translationTx("eternalMachinePage.fuse", "Fuse");
    var audioBtn = $("#em-audio-toggle");
    if (audioBtn) {
      audioBtn.textContent = eternalMachineUi.muteFuseAudio
        ? translationTx("eternalMachinePage.audioOff", "Audio: Off")
        : translationTx("eternalMachinePage.audioOn", "Audio: On");
      audioBtn.setAttribute(
        "aria-pressed",
        eternalMachineUi.muteFuseAudio ? "true" : "false",
      );
      audioBtn.setAttribute(
        "title",
        eternalMachineUi.muteFuseAudio
          ? translationTx("eternalMachinePage.audioEnableTitle", "Enable fuse sound")
          : translationTx("eternalMachinePage.audioDisableTitle", "Mute fuse sound"),
      );
    }
    var fuseClose = $("#em-fuse-close");
    if (fuseClose)
      fuseClose.setAttribute(
        "aria-label",
        translationTx("eternalMachinePage.closeResult", "Close result"),
      );
    var fuseEyebrow = root.querySelector(".em-fuse-modal__eyebrow");
    if (fuseEyebrow)
      fuseEyebrow.textContent = translationTx("eternalMachinePage.fusionEyebrow", "Eternal Machine");
    var fuseBody = $("#em-fuse-body");
    var fuseTitleEl = $("#em-fuse-title");
    if (fuseTitleEl && (!fuseBody || !String(fuseBody.innerHTML || "").trim())) {
      fuseTitleEl.textContent = translationTx("eternalMachinePage.fusionTitle", "Fusion result");
    }
    var refShow = $("#em-reference-show");
    if (refShow)
      refShow.textContent = translationTx("eternalMachinePage.referenceShow", "Show sheet reference");
    var refTb = root.querySelector(".em-reference-toolbar-title");
    if (refTb)
      refTb.textContent = translationTx("eternalMachinePage.referenceToolbar", "Sheet reference");
    var refHide = $("#em-reference-hide");
    if (refHide)
      refHide.textContent = translationTx("eternalMachinePage.referenceHide", "Hide reference");
    var refSec = $("#em-reference");
    if (refSec)
      refSec.setAttribute(
        "aria-label",
        translationTx("eternalMachinePage.refAria", "Eternal Machine reference tables"),
      );
    var pickClose = $("#em-picker-close");
    if (pickClose)
      pickClose.setAttribute(
        "aria-label",
        translationTx("eternalMachinePage.pickerClose", "Close"),
      );
    var pickTitle = $("#em-picker-title");
    if (pickTitle) {
      var cfgVis = $("#em-picker-col-configure");
      var confHidden = !cfgVis || cfgVis.hidden;
      pickTitle.textContent = confHidden
        ? translationTx("eternalMachinePage.pickerTitle", "Pick a brainrot")
        : translationTx("eternalMachinePage.pickerTitleConfigure", "Type & traits");
    }
    var pickSearch = $("#em-picker-search");
    if (pickSearch)
      pickSearch.setAttribute(
        "placeholder",
        translationTx("eternalMachinePage.pickerSearchPh", "Search name, slug, or ID…"),
      );
    var lblR = root.querySelector("#em-picker-filter-rarity");
    if (lblR && lblR.closest) {
      var lr = lblR.closest(".em-picker-filter");
      if (lr) {
        var spanR = lr.querySelector(".em-picker-filter__lbl");
        if (spanR)
          spanR.textContent = translationTx("eternalMachinePage.filterRarityLbl", "Rarity");
      }
      lblR.setAttribute(
        "aria-label",
        translationTx("brainrotsPage.ariaFilter", "Filter by rarity"),
      );
      if (lblR.options && lblR.options.length) {
        lblR.options[0].textContent = translationTx("eternalMachinePage.allRarities", "All rarities");
      }
    }
    var lblT = $("#em-picker-filter-type");
    if (lblT && lblT.closest) {
      var lt = lblT.closest(".em-picker-filter");
      if (lt) {
        var spanT = lt.querySelector(".em-picker-filter__lbl");
        if (spanT)
          spanT.textContent = translationTx("eternalMachinePage.filterTypeLbl", "Type");
      }
      lblT.setAttribute(
        "aria-label",
        translationTx("eternalMachinePage.ariaFilterCatalogType", "Filter by catalog type"),
      );
    }
    var frReset = $("#em-picker-filter-reset");
    if (frReset)
      frReset.textContent = translationTx("eternalMachinePage.resetFilters", "Reset filters");
    var pback = $("#em-picker-back");
    if (pback)
      pback.textContent = translationTx("eternalMachinePage.backToList", "← Back to list");
    var fsType = root.querySelector("#em-picker-types");
    if (fsType && fsType.closest) {
      var fsTypeFs = fsType.closest("fieldset");
      if (fsTypeFs) {
        var legT = fsTypeFs.querySelector("legend");
        if (legT)
          legT.textContent = translationTx("eternalMachinePage.legendType", "Type");
      }
    }
    var fsTraits = root.querySelector("#em-picker-traits");
    if (fsTraits && fsTraits.closest) {
      var fsTrFs = fsTraits.closest("fieldset");
      if (fsTrFs) {
        var legTr = fsTrFs.querySelector("legend");
        if (legTr)
          legTr.textContent = translationTx("eternalMachinePage.legendTraits", "Traits");
      }
    }
    var pconf = $("#em-picker-confirm");
    if (pconf)
      pconf.textContent = translationTx("eternalMachinePage.addToSlot", "Add to slot");
    root.querySelectorAll(".em-slot").forEach(function (btn, i) {
      btn.setAttribute(
        "aria-label",
        translationTx("eternalMachinePage.slotAria", "Slot {n}").replace(/\{n\}/g, String(i + 1)),
      );
    });
  }

  function renderEternalMachine() {
    function applyEternalMachinePageLastUpdated() {
      var el = $("#eternal-machine-page-updated");
      if (!el) return;
      var metaRates = ETERNAL_MACHINE_RATES && ETERNAL_MACHINE_RATES.meta ? ETERNAL_MACHINE_RATES.meta : null;
      var metaRef = ETERNAL_MACHINE_REFERENCE && ETERNAL_MACHINE_REFERENCE.meta ? ETERNAL_MACHINE_REFERENCE.meta : null;
      var meta = metaRates || metaRef;
      if (!meta || meta.lastUpdated == null || String(meta.lastUpdated).trim() === "") {
        el.hidden = true;
        el.innerHTML = "";
        return;
      }
      var raw = String(meta.lastUpdated).trim();
      var display =
        meta.lastUpdatedLabel != null && String(meta.lastUpdatedLabel).trim() !== ""
          ? String(meta.lastUpdatedLabel).trim()
          : raw;
      var attr =
        meta.lastUpdatedIso != null && String(meta.lastUpdatedIso).trim() !== ""
          ? String(meta.lastUpdatedIso).trim()
          : raw;
      el.className = "page-last-updated";
      el.innerHTML =
        '<span class="page-last-updated__label">' +
        escapeHtml(translationTx("brainrotsPage.lastUpdatedLabel", "Last updated: ")) +
        "</span>" +
        '<time class="page-last-updated__date" datetime="' +
        escapeHtml(attr) +
        '">' +
        escapeHtml(formatLastUpdatedDisplay(display)) +
        "</time>";
      el.hidden = false;
    }

    var root = $("#eternal-machine-root");
    if (!root) return;
    if (!ETERNAL_MACHINE_RATES) {
      if (root.dataset.emFetchTried === "1") {
        root.innerHTML =
          '<div class="eternal-machine"><p class="empty-state">' +
          escapeHtml(translationTx("eternalMachinePage.loadError", "Could not load data/eternal_machine_rates.json.")) +
          "</p></div>";
        document.title = eternalMachineDocumentTitle();
        return;
      }
      root.dataset.emFetchTried = "1";
      root.innerHTML =
        '<div class="eternal-machine"><p class="loading-state">' +
        escapeHtml(translationTx("eternalMachinePage.loadingRates", "Loading Eternal Machine rates…")) +
        "</p></div>";
      Promise.all([
        fetch(dataJsonUrl("data/eternal_machine_rates.json"))
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          }),
        fetch(dataJsonUrl("data/eternal_machine_reference.json"))
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          }),
      ]).then(function (pair) {
        var j = pair[0];
        var ref = pair[1];
        ETERNAL_MACHINE_RATES = j && j.columns && j.tiers && j.tiers.length ? j : null;
        ETERNAL_MACHINE_REFERENCE = ref && typeof ref === "object" ? ref : ETERNAL_MACHINE_REFERENCE;
        eternalMachineSyncReferenceTypeRates();
        renderEternalMachine();
      });
      document.title = eternalMachineDocumentTitle();
      return;
    }
    applyEternalMachinePageLastUpdated();
    eternalMachineRefreshReferenceTypeGrid();
    if (!eternalMachineUi.inited) {
      eternalMachineUi.inited = true;
      try {
        eternalMachineUi.usePremiumRates = sessionStorage.getItem("emPremiumRates") === "1";
      } catch (eEmPrem) {
        eternalMachineUi.usePremiumRates = false;
      }
      try {
        eternalMachineUi.muteFuseAudio = sessionStorage.getItem("emMuteFuseAudio") === "1";
      } catch (eEmMute) {
        eternalMachineUi.muteFuseAudio = false;
      }
      root.innerHTML =
        '<div class="eternal-machine">' +
        '<div class="em-glass lucky-section lucky-section--panel">' +
        '<div class="em-slots" id="em-slots" role="list">' +
        [0, 1, 2, 3, 4]
          .map(function (i) {
            return (
              '<button type="button" class="em-slot" data-slot="' +
              i +
              '" aria-label="' +
              escapeAttr(
                translationTx("eternalMachinePage.slotAria", "Slot {n}").replace(/\{n\}/g, String(i + 1)),
              ) +
              '"></button>'
            );
          })
          .join("") +
        "</div>" +
        '<div class="em-meta">' +
        '<p>Total base income: <strong id="em-sum-income">—</strong></p>' +
        '<p>Machine tier: <strong id="em-tier">—</strong></p>' +
        '<div class="em-premium-card" id="em-premium-card" data-sheet="normal">' +
        '<label class="em-premium-card__row" for="em-premium-rates">' +
        '<span class="em-premium-switch">' +
        '<input type="checkbox" id="em-premium-rates" class="em-premium-switch__input" ' +
        (eternalMachineUi.usePremiumRates ? "checked " : "") +
        '/>' +
        '<span class="em-premium-switch__track" aria-hidden="true"></span>' +
        "</span>" +
        '<span class="em-premium-card__head">' +
        '<span class="em-premium-card__title">Premium machine rates</span>' +
        '<span id="em-premium-pill" class="em-premium-pill" aria-live="polite">NORMAL</span>' +
        "</span>" +
        "</label>" +
        "</div>" +
        "</div>" +
        '<div class="em-outcomes" id="em-outcomes"></div>' +
        '<p id="em-status" class="em-status" role="status"></p>' +
        '<div class="em-audio-row"><button type="button" class="btn-secondary em-audio-toggle" id="em-audio-toggle" aria-pressed="false">Audio: On</button></div>' +
        '<button type="button" class="em-fuse" id="em-fuse">Fuse</button>' +
        "</div>" +
        '<div id="em-fuse-overlay" class="em-fuse-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="em-fuse-title">' +
        '<div class="em-fuse-modal">' +
        '<button type="button" class="em-fuse-close" id="em-fuse-close" aria-label="Close result">×</button>' +
        '<p class="em-fuse-modal__eyebrow">Eternal Machine</p>' +
        '<h2 id="em-fuse-title" class="em-fuse-modal__title">Fusion result</h2>' +
        '<div id="em-fuse-body" class="em-fuse-body"></div>' +
        "</div></div>" +
        '<p id="em-reference-show-wrap" class="em-reference-show-wrap" hidden>' +
        '<button type="button" class="btn-secondary" id="em-reference-show">Show sheet reference</button>' +
        "</p>" +
        '<div id="em-reference-shell" class="em-reference-shell" aria-hidden="false">' +
        '<div class="em-reference-toolbar">' +
        '<span class="em-reference-toolbar-title">Sheet reference</span>' +
        '<button type="button" class="btn-secondary em-reference-hide" id="em-reference-hide">Hide reference</button>' +
        "</div>" +
        '<section id="em-reference" class="em-reference" aria-label="Eternal Machine reference tables"></section>' +
        "</div>" +
        '<div id="em-picker-overlay" class="em-picker-overlay" hidden>' +
        '<div class="em-picker" role="dialog" aria-modal="true" aria-labelledby="em-picker-title">' +
        '<button type="button" class="em-picker-close" id="em-picker-close" aria-label="Close">×</button>' +
        '<h3 id="em-picker-title">Pick a brainrot</h3>' +
        '<div id="em-picker-body" class="em-picker-body">' +
        '<div id="em-picker-col-list" class="em-picker-col em-picker-col--list">' +
        '<input type="search" id="em-picker-search" class="em-picker-search" placeholder="Search name, slug, or ID…" autocomplete="off" />' +
        '<div class="em-picker-toolbar">' +
        '<label class="em-picker-filter"><span class="em-picker-filter__lbl">Rarity</span>' +
        '<select id="em-picker-filter-rarity" class="em-picker-select" aria-label="Filter by rarity">' +
        '<option value="all">All rarities</option>' +
        eternalMachinePickerRarityKeys()
          .map(function (r) {
            return (
              '<option value="' +
              escapeHtml(r) +
              '">' +
              escapeHtml(formatRarityLabel(r)) +
              "</option>"
            );
          })
          .join("") +
        "</select></label>" +
        '<label class="em-picker-filter"><span class="em-picker-filter__lbl">Type</span>' +
        '<select id="em-picker-filter-type" class="em-picker-select" aria-label="Filter by catalog type"></select></label>' +
        '<button type="button" class="btn-secondary em-picker-filter-reset" id="em-picker-filter-reset">Reset filters</button>' +
        "</div>" +
        '<div id="em-picker-list" class="em-picker-list"></div>' +
        "</div>" +
        '<div id="em-picker-col-configure" class="em-picker-col em-picker-col--configure" hidden>' +
        '<button type="button" class="btn-secondary em-picker-back" id="em-picker-back">← Back to list</button>' +
        '<div id="em-picker-preview" class="em-picker-preview"></div>' +
        '<fieldset class="em-picker-field"><legend>Type</legend><div id="em-picker-types" class="em-type-grid"></div></fieldset>' +
        '<fieldset class="em-picker-field"><legend>Traits</legend>' +
        '<div id="em-picker-traits" class="em-trait-grid"></div></fieldset>' +
        '<button type="button" class="em-picker-confirm btn-primary" id="em-picker-confirm">Add to slot</button>' +
        "</div></div></div></div></div>";
      var fuseBtn = $("#em-fuse");
      if (fuseBtn) fuseBtn.addEventListener("click", eternalMachineOnFuse);
      var audioBtn = $("#em-audio-toggle");
      if (audioBtn) {
        audioBtn.addEventListener("click", function () {
          eternalMachineUi.muteFuseAudio = !eternalMachineUi.muteFuseAudio;
          try {
            sessionStorage.setItem("emMuteFuseAudio", eternalMachineUi.muteFuseAudio ? "1" : "0");
          } catch (eEmMuteSt) {}
          if (eternalMachineUi.muteFuseAudio) {
            try {
              if (eternalMachineFuseAudio) {
                eternalMachineFuseAudio.pause();
                eternalMachineFuseAudio.currentTime = 0;
              }
            } catch (eEmMutePause) {}
          }
          eternalMachineRefreshStaticLabels(root);
        });
      }
      var premCb = $("#em-premium-rates");
      if (premCb) {
        premCb.disabled = !eternalMachinePremiumRatesAvailable();
        if (premCb.disabled) {
          eternalMachineUi.usePremiumRates = false;
          premCb.checked = false;
          try {
            sessionStorage.removeItem("emPremiumRates");
          } catch (ePremRm) {}
        } else {
          premCb.checked = !!eternalMachineUi.usePremiumRates;
        }
        premCb.addEventListener("change", function () {
          if (!eternalMachinePremiumRatesAvailable()) {
            premCb.checked = false;
            eternalMachineUi.usePremiumRates = false;
            return;
          }
          eternalMachineUi.usePremiumRates = !!premCb.checked;
          try {
            sessionStorage.setItem("emPremiumRates", eternalMachineUi.usePremiumRates ? "1" : "0");
          } catch (ePremSt) {}
          eternalMachineRefreshSlotsAndMeta();
        });
      }
      eternalMachineWireFuseModal(root);
      root.addEventListener("click", function (ev) {
        var clearEl = ev.target.closest && ev.target.closest("[data-clear-slot]");
        if (clearEl) {
          ev.preventDefault();
          ev.stopPropagation();
          var clearIdx = clearEl.getAttribute("data-clear-slot");
          eternalMachineUi.slots[parseInt(clearIdx, 10)] = null;
          eternalMachineRefreshSlotsAndMeta();
          return;
        }
        var slotBtn = ev.target.closest && ev.target.closest(".em-slot");
        if (slotBtn && root.contains(slotBtn)) {
          var si = parseInt(slotBtn.getAttribute("data-slot"), 10);
          if (si === si) {
            eternalMachineUi.pickerSlot = si;
            eternalMachineUi.pickerSelectedSlug = null;
            eternalMachineUi.pickerDraft = { typeSlug: "default", traits: [] };
            eternalMachineSetPickerBodyMode(false);
            var title = $("#em-picker-title");
            if (title)
              title.textContent = translationTx("eternalMachinePage.pickerTitle", "Pick a brainrot");
            var ov = $("#em-picker-overlay");
            if (ov) {
              ov.hidden = false;
              if (document && document.body) document.body.classList.add("eternal-machine-picker-open");
              var inp = $("#em-picker-search");
              if (inp) inp.value = "";
              var frO = $("#em-picker-filter-rarity");
              var ftO = $("#em-picker-filter-type");
              if (frO) frO.value = "all";
              if (ftO) {
                ftO.innerHTML = eternalMachineBuildPickerTypeFilterOptions();
                ftO.value = "all";
              }
              eternalMachineFillPickerList("");
              eternalMachineRevealReference();
            }
          }
        }
      });
      var ovLay = $("#em-picker-overlay");
      if (ovLay) {
        ovLay.addEventListener("click", function (ev) {
          if (ev.target === ovLay) eternalMachineClosePicker();
        });
      }
      var pcl = $("#em-picker-close");
      if (pcl) pcl.addEventListener("click", eternalMachineClosePicker);
      var ps = $("#em-picker-search");
      if (ps) {
        ps.addEventListener("input", function () {
          eternalMachineFillPickerList(ps.value);
        });
      }
      var frPick = $("#em-picker-filter-rarity");
      var ftPick = $("#em-picker-filter-type");
      var frReset = $("#em-picker-filter-reset");
      function eternalMachineSyncPickerListFromFilters() {
        var inpF = $("#em-picker-search");
        eternalMachineFillPickerList(inpF ? inpF.value : "");
      }
      if (frPick) frPick.addEventListener("change", eternalMachineSyncPickerListFromFilters);
      if (ftPick) ftPick.addEventListener("change", eternalMachineSyncPickerListFromFilters);
      if (frReset) {
        frReset.addEventListener("click", function () {
          if (frPick) frPick.value = "all";
          if (ftPick) {
            ftPick.innerHTML = eternalMachineBuildPickerTypeFilterOptions();
            ftPick.value = "all";
          }
          var inpR = $("#em-picker-search");
          if (inpR) inpR.value = "";
          eternalMachineFillPickerList("");
        });
      }
      if (ftPick) ftPick.innerHTML = eternalMachineBuildPickerTypeFilterOptions();
      var plist = $("#em-picker-list");
      if (plist) {
        plist.addEventListener("click", function (ev) {
          var row = ev.target.closest && ev.target.closest(".em-picker-row");
          if (!row || eternalMachineUi.pickerSlot == null) return;
          var slug = row.getAttribute("data-slug");
          var j;
          var picked = null;
          for (j = 0; j < BRAINROTS.length; j++) {
            if (BRAINROTS[j].slug === slug) {
              picked = BRAINROTS[j];
              break;
            }
          }
          if (!picked || !eternalMachineSlotRarityOk(picked)) return;
          eternalMachineUi.pickerSelectedSlug = picked.slug;
          var pickerTypes = eternalMachineTypesForPicker(picked);
          var firstType =
            pickerTypes && pickerTypes[0] && pickerTypes[0].slug ? pickerTypes[0].slug : "default";
          eternalMachineUi.pickerDraft = { typeSlug: firstType, traits: [] };
          eternalMachineRenderPickerConfigure(picked);
          eternalMachineSetPickerBodyMode(true);
          var title2 = $("#em-picker-title");
          if (title2)
            title2.textContent = translationTx(
              "eternalMachinePage.pickerTitleConfigure",
              "Type & traits",
            );
        });
      }
      var pback = $("#em-picker-back");
      if (pback) {
        pback.addEventListener("click", function () {
          eternalMachineUi.pickerSelectedSlug = null;
          eternalMachineUi.pickerDraft = { typeSlug: "default", traits: [] };
          eternalMachineSetPickerBodyMode(false);
          var title3 = $("#em-picker-title");
          if (title3)
            title3.textContent = translationTx("eternalMachinePage.pickerTitle", "Pick a brainrot");
        });
      }
      var pconf = $("#em-picker-confirm");
      if (pconf) {
        pconf.addEventListener("click", function () {
          if (eternalMachineUi.pickerSlot == null || !eternalMachineUi.pickerSelectedSlug) return;
          var st = {
            slug: eternalMachineUi.pickerSelectedSlug,
            typeSlug: eternalMachineUi.pickerDraft.typeSlug || "default",
            traits: (eternalMachineUi.pickerDraft.traits || []).slice(),
          };
          var b = eternalMachineResolveSlotB(st);
          if (!b || !eternalMachineSlotRarityOk(b)) return;
          eternalMachineUi.slots[eternalMachineUi.pickerSlot] = st;
          eternalMachineClosePicker();
          eternalMachineRefreshSlotsAndMeta();
        });
      }
      var pcfg = $("#em-picker-col-configure");
      if (pcfg) {
        pcfg.addEventListener("click", function (ev) {
          var chip = ev.target.closest && ev.target.closest(".em-type-chip");
          if (!chip) return;
          var slugT = chip.getAttribute("data-type-slug");
          if (!slugT || !eternalMachineUi.pickerSelectedSlug) return;
          if (!eternalMachineTypeAllowed(slugT)) return;
          eternalMachineUi.pickerDraft.typeSlug = slugT;
          var b2 = null;
          var k;
          for (k = 0; k < BRAINROTS.length; k++) {
            if (BRAINROTS[k].slug === eternalMachineUi.pickerSelectedSlug) {
              b2 = BRAINROTS[k];
              break;
            }
          }
          if (!b2) return;
          var chips = pcfg.querySelectorAll(".em-type-chip");
          var c;
          for (c = 0; c < chips.length; c++) {
            chips[c].classList.toggle("is-active", chips[c].getAttribute("data-type-slug") === slugT);
          }
          eternalMachineRenderPickerPreview(b2);
        });
        pcfg.addEventListener("change", function (ev) {
          var t = ev.target;
          if (!t || !t.classList || !t.classList.contains("em-trait-chip__cb")) return;
          var name = t.getAttribute("data-trait-name");
          if (!name) return;
          var arr = eternalMachineUi.pickerDraft.traits || [];
          var ix = arr.indexOf(name);
          if (t.checked) {
            if (ix < 0) arr.push(name);
          } else if (ix >= 0) {
            arr.splice(ix, 1);
          }
          eternalMachineUi.pickerDraft.traits = arr;
          var lab = t.closest && t.closest(".em-trait-chip");
          if (lab) lab.classList.toggle("is-active", t.checked);
        });
      }
      eternalMachineMountReference(root);
      var refHide = $("#em-reference-hide");
      if (refHide) {
        refHide.addEventListener("click", function () {
          eternalMachineHideReference();
        });
      }
      var refShow = $("#em-reference-show");
      if (refShow) {
        refShow.addEventListener("click", function () {
          eternalMachineRevealReference();
        });
      }
    }
    eternalMachineRefreshStaticLabels(root);
    eternalMachineRefreshSlotsAndMeta();
    document.title = eternalMachineDocumentTitle();
  }

  function normalizeCodeRow(row) {
    if (!row || typeof row !== "object") return null;
    var code = row.code != null ? String(row.code).trim() : "";
    var reward = typeof row.reward === "string" ? row.reward : "";
    if (!code) return null;
    return { code: code, reward: reward };
  }

  function normalizeCodesPayload(j) {
    if (!j || typeof j !== "object") j = {};
    var meta = j.meta && typeof j.meta === "object" ? j.meta : {};
    return {
      meta: {
        headline:
          typeof meta.headline === "string" ? meta.headline : "STEAL THE BRAINROT CODES",
        hint:
          typeof meta.hint === "string" ? meta.hint : "Click a code to mark it as used",
      },
      active: Array.isArray(j.active) ? j.active.map(normalizeCodeRow).filter(Boolean) : [],
      expired: Array.isArray(j.expired) ? j.expired.map(normalizeCodeRow).filter(Boolean) : [],
    };
  }

  function getUsedCodesMap() {
    try {
      var s = localStorage.getItem("stbarab_codes_used");
      if (!s) return {};
      var a = JSON.parse(s);
      if (!Array.isArray(a)) return {};
      var o = {};
      for (var i = 0; i < a.length; i++) o[String(a[i])] = true;
      return o;
    } catch (e) {
      return {};
    }
  }

  function persistUsedCodesFromMap(map) {
    var a = Object.keys(map);
    try {
      localStorage.setItem("stbarab_codes_used", JSON.stringify(a));
    } catch (e) {}
  }

  function toggleCodeUsed(code) {
    var k = String(code);
    var o = getUsedCodesMap();
    if (o[k]) delete o[k];
    else o[k] = true;
    persistUsedCodesFromMap(o);
  }

  function codesNotificationsEnabled() {
    if (typeof window.STBARAB_GET_CODES_NOTIFICATIONS === "function") {
      return window.STBARAB_GET_CODES_NOTIFICATIONS() === true;
    }
    return false;
  }

  function getSeenActiveCodesMap() {
    try {
      var raw = localStorage.getItem("stbarab_codes_seen_active");
      if (!raw) return null;
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      var out = {};
      var i;
      for (i = 0; i < arr.length; i++) out[String(arr[i])] = true;
      return out;
    } catch (e) {
      return null;
    }
  }

  function persistSeenActiveCodesMap(map) {
    try {
      localStorage.setItem("stbarab_codes_seen_active", JSON.stringify(Object.keys(map || {})));
    } catch (e) {}
  }

  function notifyAboutNewCodes(rows) {
    if (!rows || !rows.length) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    var count = rows.length;
    var first = rows[0] && rows[0].code ? String(rows[0].code) : "";
    var title =
      count === 1
        ? translationTx("codesNotify.singleTitle", "New code available")
        : translationTx("codesNotify.multiTitle", "New codes available");
    var body =
      count === 1
        ? translationTx("codesNotify.singleBody", "Code: {code}").replace(/\{code\}/g, first || "—")
        : translationTx("codesNotify.multiBody", "{count} new active codes were added.").replace(
            /\{count\}/g,
            String(count)
          );
    try {
      new Notification(title, { body: body, tag: "stbarab-codes", renotify: true });
    } catch (e) {}
  }

  function checkForNewCodesAndNotify() {
    if (!codesNotificationsEnabled()) return;
    if (!CODES_PAYLOAD || !Array.isArray(CODES_PAYLOAD.active)) return;
    var active = CODES_PAYLOAD.active;
    var seen = getSeenActiveCodesMap();
    var cur = {};
    var i;
    for (i = 0; i < active.length; i++) {
      var code = active[i] && active[i].code != null ? String(active[i].code).trim() : "";
      if (!code) continue;
      cur[code] = true;
    }
    if (!seen) {
      persistSeenActiveCodesMap(cur);
      return;
    }
    var fresh = [];
    for (i = 0; i < active.length; i++) {
      var r = active[i];
      var c = r && r.code != null ? String(r.code).trim() : "";
      if (!c || seen[c]) continue;
      fresh.push(r);
    }
    if (fresh.length) notifyAboutNewCodes(fresh);
    persistSeenActiveCodesMap(cur);
  }

  /** True when Discord session UI shows the logged-in profile (matches <code>#header-user-logged</code> visibility). */
  function isDiscordLoggedIn() {
    var logged = document.getElementById("header-user-logged");
    return !!(logged && !logged.hidden);
  }

  function maybeRefreshCodesPage() {
    var cv = document.getElementById("view-codes");
    if (!cv || cv.hidden) return;
    renderCodes();
  }

  /** Uppercase month + year from local date, e.g. <code>APRIL 2026</code> — no manual JSON updates. */
  function getCodesMonthYearLabel() {
    var d = new Date();
    var lg = document.documentElement.lang || "en";
    if (lg && lg !== "en") {
      try {
        return d
          .toLocaleDateString(lg, { month: "long", year: "numeric" })
          .replace(/\s+/g, " ")
          .trim()
          .toUpperCase();
      } catch (eLc) {}
    }
    var months = [
      "JANUARY",
      "FEBRUARY",
      "MARCH",
      "APRIL",
      "MAY",
      "JUNE",
      "JULY",
      "AUGUST",
      "SEPTEMBER",
      "OCTOBER",
      "NOVEMBER",
      "DECEMBER",
    ];
    return months[d.getMonth()] + " " + d.getFullYear();
  }

  var CODES_SVG_GIFT_TAB =
    '<svg class="codes-tab__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m-8.25 3.75h4.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125zm16.5-3.75h-4.125c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h4.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125z" /></svg>';

  var CODES_SVG_CLOCK_TAB =
    '<svg class="codes-tab__icon codes-tab__icon--clock" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m7.5 0a9.75 9.75 0 11-19.5 0 9.75 9.75 0 0119.5 0z" /></svg>';

  var CODES_SVG_GIFT_SM =
    '<svg class="codes-card__gift" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m-8.25 3.75h4.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125zm16.5-3.75h-4.125c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h4.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125z" /></svg>';

  function renderCodes() {
    var root = $("#codes-root");
    if (!root) return;
    var payload = CODES_PAYLOAD;
    if (!payload) {
      root.innerHTML =
        '<div class="codes-inner"><p class="empty-state">' +
        escapeHtml(translationTx("codesPage.emptyConfig", "No code list configured. Add data/codes.json.")) +
        "</p></div>";
      return;
    }
    var used = getUsedCodesMap();
    var na = payload.active.length;
    var ne = payload.expired.length;
    var mode = codesPanelMode === "expired" ? "expired" : "active";
    var list = mode === "expired" ? payload.expired : payload.active;
    var sub = '<p class="codes-hero__sub">' + escapeHtml(getCodesMonthYearLabel()) + "</p>";
    var loggedIn = isDiscordLoggedIn();
    var rawHint = payload.meta && typeof payload.meta.hint === "string" ? payload.meta.hint.trim() : "";
    var hintResolved =
      !rawHint || rawHint === "Click a code to mark it as used"
        ? translationTx("codesPage.defaultHint", "Click a code to mark it as used")
        : rawHint;
    var hintBar =
      mode === "active" && loggedIn ? '<p class="codes-hint">' + escapeHtml(hintResolved) + "</p>" : "";

    var cardsHtml = "";
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      var ec = escapeHtml(row.code);
      var er = escapeHtml(row.reward);
      if (mode === "active") {
        var isUsed = !!used[row.code];
        var badgeActiveOrUsed = isUsed
          ? '<span class="codes-card__badge codes-card__badge--used">' +
            escapeHtml(translationTx("codesPage.badgeUsed", "Used")) +
            "</span>"
          : '<span class="codes-card__badge codes-card__badge--active">' +
            escapeHtml(translationTx("codesPage.badgeActive", "Active")) +
            "</span>";
        if (loggedIn) {
          cardsHtml +=
            '<button type="button" class="codes-card codes-card--clickable' +
            (isUsed ? " codes-card--used" : "") +
            '" data-code="' +
            escapeAttr(row.code) +
            '" data-panel="active">' +
            '<span class="codes-card__dot codes-card__dot--active" aria-hidden="true"></span>' +
            '<span class="codes-card__code">' +
            ec +
            "</span>" +
            badgeActiveOrUsed +
            '<span class="codes-card__reward">' +
            CODES_SVG_GIFT_SM +
            er +
            "</span>" +
            "</button>";
        } else {
          cardsHtml +=
            '<div class="codes-card' +
            (isUsed ? " codes-card--used" : "") +
            '" data-panel="active" role="group">' +
            '<span class="codes-card__dot codes-card__dot--active" aria-hidden="true"></span>' +
            '<span class="codes-card__code">' +
            ec +
            "</span>" +
            badgeActiveOrUsed +
            '<span class="codes-card__reward">' +
            CODES_SVG_GIFT_SM +
            er +
            "</span>" +
            "</div>";
        }
      } else {
        cardsHtml +=
          '<div class="codes-card codes-card--expired" data-panel="expired" role="group">' +
          '<span class="codes-card__dot codes-card__dot--expired" aria-hidden="true"></span>' +
          '<span class="codes-card__code">' +
          ec +
          "</span>" +
          '<span class="codes-card__badge codes-card__badge--expired">' +
          escapeHtml(translationTx("codesPage.badgeExpired", "Expired")) +
          "</span>" +
          '<span class="codes-card__reward">' +
          CODES_SVG_GIFT_SM +
          er +
          "</span>" +
          "</div>";
      }
    }
    if (!cardsHtml) {
      cardsHtml =
        '<p class="codes-empty">' +
        escapeHtml(
          mode === "expired"
            ? translationTx("codesPage.noneExpired", "No expired codes listed.")
            : translationTx("codesPage.noneActive", "No active codes listed."),
        ) +
        "</p>";
    }

    root.innerHTML =
      '<div class="codes-inner">' +
      '<div class="codes-hero">' +
      '<h1 class="codes-hero__title">' +
      escapeHtml(payload.meta.headline) +
      "</h1>" +
      sub +
      "</div>" +
      '<div class="codes-tabs" role="tablist" aria-label="' +
      escapeAttr(translationTx("codesPage.tablistAria", "Code type")) +
      '">' +
      '<button type="button" class="codes-tab codes-tab--kind-active" role="tab" data-codes-tab="active" aria-pressed="' +
      (mode === "active" ? "true" : "false") +
      '" aria-selected="' +
      (mode === "active" ? "true" : "false") +
      '">' +
      CODES_SVG_GIFT_TAB +
      escapeHtml(translationTx("codesPage.tabActive", "Active")) +
      " (" +
      na +
      ")" +
      "</button>" +
      '<button type="button" class="codes-tab codes-tab--kind-expired" role="tab" data-codes-tab="expired" aria-pressed="' +
      (mode === "expired" ? "true" : "false") +
      '" aria-selected="' +
      (mode === "expired" ? "true" : "false") +
      '">' +
      CODES_SVG_CLOCK_TAB +
      escapeHtml(translationTx("codesPage.tabExpired", "Expired")) +
      " (" +
      ne +
      ")" +
      "</button>" +
      "</div>" +
      hintBar +
      '<div class="codes-list">' +
      cardsHtml +
      "</div>" +
      "</div>";
  }

  function ensureCodesPageHandlers() {
    if (codesPageHandlersBound) return;
    var view = $("#view-codes");
    if (!view) return;
    codesPageHandlersBound = true;
    view.addEventListener("click", function (e) {
      var tabBtn = e.target.closest("[data-codes-tab]");
      if (tabBtn && view.contains(tabBtn)) {
        var mode = tabBtn.getAttribute("data-codes-tab");
        if (mode === "active" || mode === "expired") {
          codesPanelMode = mode;
          renderCodes();
        }
        return;
      }
      var card = e.target.closest(".codes-card[data-code]");
      if (!card || !view.contains(card)) return;
      if (card.getAttribute("data-panel") !== "active") return;
      if (!isDiscordLoggedIn()) return;
      var code = card.getAttribute("data-code");
      if (!code) return;
      e.preventDefault();
      toggleCodeUsed(code);
      renderCodes();
    });
  }

  var SHOP_LAYOUT_FALLBACK = {
    categories: [
      {
        id: "grande-rots",
        navLabel: "GRANDE ROTS",
        navTone: "purple",
        sectionTitle: "Grande Rots",
        kind: "cards",
        cards: [{ name: "Grande Rot", rarity: "Mythic", price: 150 }],
      },
      {
        id: "server-luck",
        navLabel: "SERVER LUCK",
        navTone: "green",
        sectionTitle: "Server Luck",
        kind: "banner",
        banner: { lineLeft: "1x", lineSub: ">", lineEmphasis: "2x", sub: "For 15 Minutes", price: 200 },
      },
    ],
  };

  function normalizeShopPayload(j) {
    var out = { categories: [] };
    if (!j || typeof j !== "object") return out;
    if (!Array.isArray(j.categories)) return out;
    j.categories.forEach(function (c) {
      if (!c || typeof c !== "object") return;
      if (!c.id || !String(c.id).trim()) return;
      out.categories.push(c);
    });
    return out;
  }

  function shopRarityToken(r) {
    var s = String(r == null ? "" : r)
      .trim()
      .toLowerCase();
    if (s === "brainrot god" || s === "brainrotgod") return "brainrot-god";
    s = s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return s || "common";
  }

  function renderShopPage() {
    var root = $("#shop-root");
    if (!root) return;
    if (!shopDataReady || !SHOP_PAYLOAD) {
      root.innerHTML =
        '<div class="traits-inner shop-view"><p class="loading-state">' +
        escapeHtml(translationTx("shopPage.loading", "Loading shop…")) +
        "</p></div>";
      maybeStartLazyDataLoads();
      return;
    }
    var cats = SHOP_PAYLOAD.categories || [];
    var navBtns = cats
      .map(function (c) {
        var id = escapeHtml(String(c.id));
        var lab = escapeHtml(String(c.navLabel || c.sectionTitle || c.id));
        return (
          '<li><button type="button" class="btn-secondary shop-toc__btn" data-shop-jump="' +
          id +
          '">' +
          lab +
          "</button></li>"
        );
      })
      .join("");
    var mainSections = cats
      .map(function (c) {
        var sectionId = escapeHtml(String(c.id));
        var secTitle = escapeHtml(String(c.sectionTitle || c.id));
        var kind = String(c.kind || "empty");
        if (kind === "cards") {
          var cards = (c.cards || [])
            .map(function (card) {
              var rt = shopRarityToken(card.rarity);
              var nm = escapeHtml(String(card.name || ""));
              var price = escapeHtml(String(card.price != null ? card.price : ""));
              return (
                '<article class="shop-card shop-card--' +
                rt +
                '"><div class="shop-card__art" aria-hidden="true"><span class="shop-card__ring"></span><span class="shop-card__blob"></span></div><div class="shop-card__head"><h3 class="shop-card__name">' +
                nm +
                '</h3><button type="button" class="shop-card__info" aria-label="' +
                escapeAttr(translationTx("shopPage.cardInfoAria", "Item info")) +
                '">!</button></div><div class="shop-card__price"><span class="shop-currency" aria-hidden="true"></span><span>' +
                price +
                "</span></div></article>"
              );
            })
            .join("");
          return (
            '<section class="lucky-section lucky-section--panel shop-block" id="shop-section-' +
            sectionId +
            '"><div class="lucky-section__header"><h2 class="lucky-section__title"><span class="lucky-section__title-text">' +
            secTitle +
            '</span></h2></div><div class="shop-card-row">' +
            cards +
            "</div></section>"
          );
        }
        if (kind === "banner") {
          var b = c.banner && typeof c.banner === "object" ? c.banner : {};
          var lineL = escapeHtml(String(b.lineLeft != null ? b.lineLeft : ""));
          var lineE = escapeHtml(String(b.lineEmphasis != null ? b.lineEmphasis : ""));
          var arr = escapeHtml(String(b.lineSub != null ? b.lineSub : ">"));
          var sub = escapeHtml(String(b.sub != null ? b.sub : ""));
          var price = escapeHtml(String(b.price != null ? b.price : ""));
          return (
            '<section class="lucky-section lucky-section--panel shop-block" id="shop-section-' +
            sectionId +
            '"><div class="lucky-section__header"><h2 class="lucky-section__title"><span class="lucky-section__title-text">' +
            secTitle +
            '</span></h2></div><div class="shop-banner"><div class="shop-banner__clover" aria-hidden="true">\uD83C\uDF40</div><div class="shop-banner__center"><p class="shop-banner__line"><span class="shop-banner__muted">' +
            lineL +
            '</span> <span class="shop-banner__sep">' +
            arr +
            '</span> <span class="shop-banner__emph">' +
            lineE +
            '</span></p><p class="shop-banner__sub">' +
            sub +
            '</p></div><div class="shop-banner__price"><span class="shop-currency" aria-hidden="true"></span><span>' +
            price +
            "</span></div></div></section>"
          );
        }
        var ek = c.emptyTextKey ? String(c.emptyTextKey) : "emptyGear";
        var di18n = "shopPage.emptyGear";
        if (ek === "emptyGamepass") di18n = "shopPage.emptyGamepass";
        else if (ek === "emptyWaves") di18n = "shopPage.emptyWaves";
        var fb = "Gear slots and boosts appear in the live game.";
        if (ek === "emptyGamepass") fb = "Robux gamepasses appear in the live game.";
        else if (ek === "emptyWaves") fb = "Wave boosts are configured in the live game.";
        return (
          '<section class="lucky-section lucky-section--panel shop-block" id="shop-section-' +
          sectionId +
          '"><div class="lucky-section__header"><h2 class="lucky-section__title"><span class="lucky-section__title-text">' +
          secTitle +
          '</span></h2></div><p class="traits-footnote shop-empty" data-i18n="' +
          di18n +
          '">' +
          escapeHtml(translationTx(di18n, fb)) +
          "</p></section>"
        );
      })
      .join("");
    root.innerHTML =
      '<div class="shop-view traits-inner">' +
      '<div class="traits-hero rebirth-hero">' +
      '<h1 data-i18n="shopPage.heroTitle">Shop</h1>' +
      '<p class="lucky-section__intro" data-i18n="shopPage.disclaimer">' +
      escapeHtml(
        translationTx(
          "shopPage.disclaimer",
          "Reference layout only. Prices and items mirror the in-game shop style; this site does not sell Robux or in-game currency.",
        ),
      ) +
      '</p></div><div class="shop-view__grid"><nav class="shop-toc" aria-label="' +
      escapeAttr(translationTx("shopPage.sidebarNavAria", "Shop categories")) +
      '"><p class="shop-toc__label" data-i18n="shopPage.tocLabel">Categories</p><ul class="shop-toc__list">' +
      navBtns +
      '</ul><a class="btn-secondary shop-toc__home" href="#" data-spa-path="/" data-i18n="shopPage.backHome">Back to home</a></nav><div class="shop-view__panels">' +
      mainSections +
      "</div></div></div>";
    root.querySelectorAll("[data-shop-jump]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-shop-jump");
        if (!id) return;
        var sec = document.getElementById("shop-section-" + id);
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    applySiteI18n(root);
  }

  function renderCollectionPage() {
    window.STBARAB_BRAINROTS = BRAINROTS;
    window.STBARAB_TYPES_CATALOG = BRAINROT_TYPES_CATALOG;
    /** Raw type sheet URL (full PNG). Prefer STBARAB_BRAINROT_THUMB_MEDIA_HTML for sliced cell art. */
    window.STBARAB_BRAINROT_TYPE_ICON_URL = function (b, typeSlug) {
      if (!b) return brainrotIconUrl({ slug: "fishini-bossini" });
      var ts = typeSlug || "default";
      var t = findBrainrotType(b, ts);
      if (!t) return brainrotIconUrl(b);
      return typeIconUrl(b, t);
    };
    /** Same HTML as brainrot detail / grid: atlas slice or single icon, not the whole sheet as one img. */
    window.STBARAB_BRAINROT_THUMB_MEDIA_HTML = brainrotThumbMediaHtml;
    window.STBARAB_HYDRATE_BRAINROT_THUMBS = hydrateBrainrotAtlasProbes;
    window.STBARAB_BASE_TITLE = BASE_TITLE;
    window.STBARAB_APP_PATH_PREFIX = getAppPathPrefix();
    document.title = collectionDocumentTitle();
    if (window.STBARAB_RENDER_COLLECTION) window.STBARAB_RENDER_COLLECTION();
  }

  function blogDateLabel(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (!(d && d.getTime && d.getTime() === d.getTime())) return "";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function blogLatestCreatedAt(items) {
    var list = Array.isArray(items) ? items : [];
    var latest = 0;
    for (var i = 0; i < list.length; i++) {
      var raw = list[i] && list[i].createdAt ? list[i].createdAt : "";
      var t = Date.parse(String(raw || ""));
      if (t === t && t > latest) latest = t;
    }
    return latest > 0 ? new Date(latest).toISOString() : "";
  }

  function blogLookupById(postId) {
    var id = String(postId || "");
    for (var i = 0; i < BLOG_ITEMS.length; i++) {
      if (String(BLOG_ITEMS[i].id || "") === id) return BLOG_ITEMS[i];
    }
    return null;
  }

  function blogReadPath(postId) {
    return "/blog/" + encodeURIComponent(String(postId || ""));
  }

  function blogImageSource(item) {
    if (item && item.imageWebp) return item.imageWebp;
    if (item && item.image) return item.image;
    return "";
  }

  function renderBlogPage() {
    var root = $("#blog-root");
    if (!root) return;
    if (blogLoading) {
      root.innerHTML =
        '<div class="blog-inner"><p class="loading-state">' +
        escapeHtml(translationTx("blogPage.loadingList", "Loading blog posts…")) +
        "</p></div>";
      return;
    }
    if (BLOG_ERROR) {
      root.innerHTML =
        '<div class="blog-inner"><p class="empty-state">' + escapeHtml(BLOG_ERROR) + "</p></div>";
      return;
    }
    if (!BLOG_ITEMS.length) {
      root.innerHTML =
        '<div class="blog-inner"><p class="empty-state">' +
        escapeHtml(translationTx("blogPage.emptyList", "No blog posts found.")) +
        "</p></div>";
      return;
    }
    var cards = BLOG_ITEMS.map(function (item) {
      var postId = String(item.id || "");
      var title = escapeHtml(item.title || translationTx("blogPage.fallbackPostTitle", "Epic Community post"));
      var href = escapeAttr(blogReadPath(postId));
      var date = blogDateLabel(item.createdAt);
      var imageUrl = blogImageSource(item);
      var media = imageUrl
        ? '<img class="blog-card__img" src="' +
          escapeAttr(imageUrl) +
          '" alt="" loading="lazy" decoding="async" onerror="this.closest(\'.blog-card\').classList.add(\'blog-card--no-img\');this.remove();" />'
        : "";
      return (
        '<article class="blog-card">' +
        '<a class="blog-card__link" href="' +
        href +
        '" data-spa-path="' +
        href +
        '">' +
        media +
        '<div class="blog-card__body">' +
        '<h3 class="blog-card__title">' +
        title +
        "</h3>" +
        (date ? '<p class="blog-card__date">' + escapeHtml(date) + "</p>" : "") +
        "</div></a></article>"
      );
    }).join("");
    root.innerHTML =
      '<div class="blog-inner">' +
      '<div class="blog-hero">' +
      '<h1 class="blog-hero__title">' +
      escapeHtml(translationTx("blogPage.heroTitle", "Epic Community Blog")) +
      "</h1>" +
      (blogLatestCreatedAt(BLOG_ITEMS)
        ? '<p class="blog-hero__sub">' +
          escapeHtml(translationTx("blogPage.heroUpdated", "Updated ")) +
          escapeHtml(blogDateLabel(blogLatestCreatedAt(BLOG_ITEMS))) +
          "</p>"
        : "") +
      "</div>" +
      '<div class="blog-grid">' +
      cards +
      "</div></div>";
  }

  function fetchBlogPosts(force) {
    var maxAge = 2 * 60 * 1000;
    if (!force && BLOG_ITEMS.length && Date.now() - blogLoadedAt < maxAge) return Promise.resolve();
    if (blogLoading) return Promise.resolve();
    blogLoading = true;
    BLOG_ERROR = "";
    renderBlogPage();
    return fetch(siteApiUrl("api/blog"))
      .then(function (r) {
        if (!r.ok) throw new Error("blog_api");
        return r.json();
      })
      .then(function (j) {
        var items = Array.isArray(j && j.items) ? j.items : [];
        BLOG_ITEMS = items;
        blogLoadedAt = Date.now();
      })
      .catch(function () {
        BLOG_ERROR = "Could not load blog posts right now.";
      })
      .finally(function () {
        blogLoading = false;
        renderBlogPage();
      });
  }

  function fetchBlogPostById(postId, force) {
    var existing = blogLookupById(postId);
    if (!force && existing) {
      BLOG_DETAIL = existing;
      BLOG_DETAIL_ERROR = "";
      renderBlogDetailPage(postId);
      return Promise.resolve(existing);
    }
    if (blogDetailLoading) return Promise.resolve(BLOG_DETAIL);
    blogDetailLoading = true;
    BLOG_DETAIL_ERROR = "";
    BLOG_DETAIL = null;
    renderBlogDetailPage(postId);
    return fetch(siteApiUrl("api/blog/" + encodeURIComponent(String(postId || ""))))
      .then(function (r) {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error("blog_item_api");
        return r.json();
      })
      .then(function (j) {
        var item = j && j.item ? j.item : null;
        if (!item || !item.id) throw new Error("not_found");
        BLOG_DETAIL = item;
        BLOG_DETAIL_ERROR = "";
      })
      .catch(function (e) {
        if (e && String(e.message || "") === "not_found") {
          BLOG_DETAIL_ERROR = "Blog post not found.";
        } else {
          BLOG_DETAIL_ERROR = "Could not load this blog post.";
        }
      })
      .finally(function () {
        blogDetailLoading = false;
        renderBlogDetailPage(postId);
      });
  }

  function renderBlogDetailPage(postId) {
    var root = $("#blog-detail-root");
    if (!root) return;
    var item = BLOG_DETAIL && String(BLOG_DETAIL.id || "") === String(postId || "") ? BLOG_DETAIL : null;
    if (blogDetailLoading) {
      root.innerHTML =
        '<div class="blog-detail"><p class="loading-state">' +
        escapeHtml(translationTx("blogDetailPage.loadingPost", "Loading blog post…")) +
        "</p></div>";
      return;
    }
    if (!item && BLOG_DETAIL_ERROR) {
      root.innerHTML = '<div class="blog-detail"><p class="empty-state">' + escapeHtml(BLOG_DETAIL_ERROR) + "</p></div>";
      return;
    }
    if (!item) {
      root.innerHTML =
        '<div class="blog-detail"><p class="loading-state">' +
        escapeHtml(translationTx("blogDetailPage.loadingPost", "Loading blog post…")) +
        "</p></div>";
      return;
    }
    var imageUrl = blogImageSource(item);
    var title = escapeHtml(item.title || translationTx("blogDetailPage.docTitle", "Blog"));
    var body = escapeHtml(item.body || "").replace(/\n/g, "<br />");
    var date = blogDateLabel(item.createdAt);
    var author = escapeHtml(item.author || "FeRinЅ");
    var heroStyle = imageUrl
      ? ' style="background-image:linear-gradient(180deg, rgba(2,6,23,.2), rgba(2,6,23,.88)), url(\'' +
        escapeAttr(imageUrl) +
        '\')"'
      : "";
    root.innerHTML =
      '<article class="blog-detail">' +
      '<header class="blog-detail__hero"' +
      heroStyle +
      ">" +
      '<a class="blog-detail__back" href="#" data-spa-path="/blog">' +
      escapeHtml(translationTx("blogDetailPage.backToBlog", "Back to blog")) +
      "</a>" +
      '<h1 class="blog-detail__title">' +
      title +
      "</h1>" +
      '<p class="blog-detail__meta">' +
      (date ? escapeHtml(date) + " · " : "") +
      author +
      "</p>" +
      "</header>" +
      '<section class="blog-detail__body">' +
      (body ? '<p class="blog-detail__text">' + body + "</p>" : "") +
      (item.url
        ? '<p class="blog-detail__source"><a href="' +
          escapeAttr(item.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(translationTx("blogDetailPage.openOriginal", "Open original Epic post")) +
          "</a></p>"
        : "") +
      "</section></article>";
  }

  function ensureBlogPageHandlers() {
    if (blogPageHandlersBound) return;
    var view = $("#view-blog");
    if (!view) return;
    blogPageHandlersBound = true;
    view.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
    });
  }

  /** Types grid: clicking a tile updates hero art + base income × type multiplier. */
  function wireDetailTypePicker(root, b) {
    var stage = root.querySelector("#detail-preview-stage");
    var incomeEl = root.querySelector("#detail-dd-income");
    var metaEl = root.querySelector("#detail-income-type-meta");
    var buttons = root.querySelectorAll(".style-tile--pick");
    if (!stage || !incomeEl || !buttons.length) return;

    function applyType(btn) {
      var slug = btn.getAttribute("data-type-slug") || "default";
      var mult = getCatalogTypeMultiplier(slug);
      if (!(mult > 0) || mult !== mult) mult = 1;
      var i;
      for (i = 0; i < buttons.length; i++) {
        var x = buttons[i];
        x.classList.toggle("is-active", x === btn);
        x.setAttribute("aria-pressed", x === btn ? "true" : "false");
      }
      stage.innerHTML = brainrotThumbMediaHtml(b.name, b, slug, {
        imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas detail-preview__img",
        fallbackClass: "detail-preview__glyph detail-preview__glyph--fallback",
      });
      stage.classList.remove("has-img");
      hydrateBrainrotAtlasProbes(stage);
      incomeEl.textContent = formatIncomePerSec(b.incomePerSec * mult);
      if (metaEl) {
        var labEl = btn.querySelector(".style-tile__label");
        var lab = labEl ? labEl.textContent.trim() : slug;
        metaEl.textContent = " · " + lab + " (" + formatMultiplier(mult) + "×)";
      }
    }

    function indexOfActiveType() {
      var i;
      for (i = 0; i < buttons.length; i++) {
        if (buttons[i].classList.contains("is-active")) return i;
      }
      return 0;
    }

    function stepType(delta) {
      var n = buttons.length;
      if (n < 2) return;
      var j = (indexOfActiveType() + delta + n * 8) % n;
      applyType(buttons[j]);
    }

    var prevBtn = root.querySelector("#detail-type-prev");
    var nextBtn = root.querySelector("#detail-type-next");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        stepType(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        stepType(1);
      });
    }

    var k;
    for (k = 0; k < buttons.length; k++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          applyType(btn);
        });
      })(buttons[k]);
    }
  }

  function getDetailActiveTypeSlug(root) {
    var act = root.querySelector(".style-tile--pick.is-active");
    if (act) return act.getAttribute("data-type-slug") || "default";
    return "default";
  }

  function detailIconFileBaseName(b, typeSlug) {
    var base = String((b && b.slug) || "brainrot")
      .replace(/[^\w\-]+/g, "-")
      .replace(/^\-+|\-+$/g, "");
    if (!base) base = "brainrot";
    var ts = String(typeSlug || "default")
      .replace(/[^\w\-]+/g, "-")
      .replace(/^\-+|\-+$/g, "");
    if (!ts) ts = "default";
    return base + "-" + ts + ".png";
  }

  function detailBlobDownload(blob, filename) {
    if (!blob) return;
    var a = document.createElement("a");
    var u = URL.createObjectURL(blob);
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(u);
    }, 4000);
  }

  function detailCanvasToPngDownload(canvas, filename) {
    if (!canvas) return;
    try {
      canvas.toBlob(function (blob) {
        detailBlobDownload(blob, filename);
      }, "image/png");
    } catch (eBlob) {}
  }

  function detailFetchUrlAsDownload(url, filename) {
    if (!url) return;
    fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.blob() : null;
      })
      .then(function (blob) {
        detailBlobDownload(blob, filename);
      })
      .catch(function () {});
  }

  function detailRunIconDownload(stage, b, typeSlug) {
    var filename = detailIconFileBaseName(b, typeSlug);
    var slice = stage.querySelector(".brainrot-thumb__atlas-slice");
    var probe = stage.querySelector("img.brainrot-thumb__atlas-probe");
    if (slice && probe) {
      var cols = Math.max(1, parseInt(slice.getAttribute("data-em-cols") || "9", 10));
      var rows = Math.max(1, parseInt(slice.getAttribute("data-em-rows") || "9", 10));
      var idx = Math.max(0, parseInt(slice.getAttribute("data-em-idx") || "0", 10));
      function runCrop() {
        if (!(probe.naturalWidth > 0)) return;
        var w = probe.naturalWidth;
        var h = probe.naturalHeight;
        var cw = w / cols;
        var ch = h / rows;
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.floor(cw));
        c.height = Math.max(1, Math.floor(ch));
        var ctx = c.getContext("2d");
        if (!ctx) return;
        try {
          ctx.drawImage(probe, col * cw, row * ch, cw, ch, 0, 0, c.width, c.height);
          detailCanvasToPngDownload(c, filename);
        } catch (eDraw) {}
      }
      if (probe.complete && probe.naturalWidth > 0) {
        runCrop();
      } else {
        probe.addEventListener(
          "load",
          function () {
            runCrop();
          },
          { once: true }
        );
        probe.addEventListener(
          "error",
          function () {},
          { once: true }
        );
      }
      return;
    }
    var img = stage.querySelector("img.brainrot-thumb__img");
    if (!img || img.classList.contains("brainrot-thumb__atlas-probe")) {
      return;
    }
    function runFull() {
      if (!(img.naturalWidth > 0)) {
        detailFetchUrlAsDownload(img.currentSrc || img.src, filename);
        return;
      }
      var c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var ctx = c.getContext("2d");
      if (!ctx) {
        detailFetchUrlAsDownload(img.currentSrc || img.src, filename);
        return;
      }
      try {
        ctx.drawImage(img, 0, 0);
        detailCanvasToPngDownload(c, filename);
      } catch (eDraw) {
        detailFetchUrlAsDownload(img.currentSrc || img.src, filename);
      }
    }
    if (img.complete && img.naturalWidth > 0) {
      runFull();
    } else {
      img.addEventListener(
        "load",
        function () {
          runFull();
        },
        { once: true }
      );
      img.addEventListener(
        "error",
        function () {
          detailFetchUrlAsDownload(img.currentSrc || img.src, filename);
        },
        { once: true }
      );
    }
  }

  function wireDetailIconDownload(root, b) {
    var btn = root.querySelector("#detail-save-icon");
    var stage = root.querySelector("#detail-preview-stage");
    if (!btn || !stage || !b) return;
    if (btn.getAttribute("data-icon-download-wire") === "1") return;
    btn.setAttribute("data-icon-download-wire", "1");
    btn.addEventListener("click", function () {
      var typeSlug = getDetailActiveTypeSlug(root);
      detailRunIconDownload(stage, b, typeSlug);
    });
  }

  function wireDetailRating(root, b) {
    var api = siteApiUrl("api/brainrot-ratings");
    if (!api || !b || !b.slug) return;
    var slug = b.slug;
    var barHost = root.querySelector("#detail-reaction-bar-host");
    var hintEl = root.querySelector("#detail-reaction-login-hint");
    var errEl = root.querySelector("#detail-reaction-error");
    if (!barHost) return;

    function countsFromAggregate(agg) {
      if (agg && agg.reactions && typeof agg.reactions === "object") return agg.reactions;
      return {};
    }

    function mergeCountsToRatings(agg) {
      if (!agg || !agg.reactions) return;
      var tv = typeof agg.totalVotes === "number" ? agg.totalVotes : 0;
      if (tv <= 0) {
        delete BRAINROT_RATINGS[slug];
      } else {
        BRAINROT_RATINGS[slug] = {
          reactions: agg.reactions,
          totalVotes: tv,
          score: typeof agg.score === "number" && agg.score === agg.score ? agg.score : null,
        };
      }
    }

    function renderBar(counts, myReaction) {
      var cc = {};
      BRAINROT_REACTION_DEFS.forEach(function (d) {
        cc[d.id] = counts && typeof counts[d.id] === "number" && counts[d.id] === counts[d.id] ? counts[d.id] : 0;
      });
      barHost.innerHTML =
        '<div class="brainrot-reaction-bar" role="group" aria-label="Brainrot reactions">' +
        BRAINROT_REACTION_DEFS.map(function (d) {
          var c = cc[d.id] || 0;
          var active = myReaction === d.id;
          return (
            '<button type="button" class="brainrot-reaction-bar__btn' +
            (active ? " is-selected" : "") +
            '" data-reaction="' +
            escapeAttr(d.id) +
            '" aria-pressed="' +
            (active ? "true" : "false") +
            '" title="' +
            escapeAttr(d.label) +
            '">' +
            '<span class="brainrot-reaction-bar__icon" aria-hidden="true">' +
            stbIconSvg(d.icon, "brainrot-reaction-bar__icon-svg brainrot-reaction-bar__icon-svg--" + d.id) +
            "</span>" +
            '<span class="brainrot-reaction-bar__count">' +
            formatReactionCompactCount(c) +
            "</span></button>"
          );
        }).join("") +
        "</div>";
    }

    function applyLocal() {
      var x = BRAINROT_RATINGS[slug];
      if (x && x.reactions) {
        renderBar(x.reactions, null);
      } else {
        renderBar({}, null);
      }
    }

    applyLocal();

    fetch(api + "?slug=" + encodeURIComponent(slug), { credentials: "include" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (!j || !j.ok) return;
        if (j.aggregate) mergeCountsToRatings(j.aggregate);
        renderBar(countsFromAggregate(j.aggregate), j.myReaction);
        if (hintEl) hintEl.hidden = true;
      })
      .catch(function () {});

    barHost.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-reaction]") : null;
      if (!btn) return;
      var rid = btn.getAttribute("data-reaction");
      if (!rid) return;
      if (errEl) errEl.hidden = true;
      fetch(api, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, reaction: rid }),
      })
        .then(function (r) {
          if (r.status === 401) {
            if (hintEl) hintEl.hidden = false;
            return null;
          }
          return r.json();
        })
        .then(function (j) {
          if (!j || !j.ok) return;
          if (hintEl) hintEl.hidden = true;
          if (j.aggregate) mergeCountsToRatings(j.aggregate);
          renderBar(countsFromAggregate(j.aggregate), j.myReaction);
        })
        .catch(function () {
          if (errEl) {
            errEl.textContent = "Could not save reaction.";
            errEl.hidden = false;
          }
        });
    });
  }


  function renderDetail(slug) {
    var root = $("#detail-root");
    if (!root) return;

    if (loadFailed) {
      root.innerHTML =
        '<div class="detail-inner"><p class="detail-404">Could not load the catalog.</p>' +
        '<a class="btn-secondary" href="' +
        escapeHtml(spaHref("/")) +
        '" data-spa-path="/">Home</a></div>';
      document.title = BASE_TITLE;
      return;
    }

    var b = findBrainrotForDetailPath(slug);
    if (!b) {
      root.innerHTML =
        '<div class="detail-inner">' +
        '<p class="detail-404">Brainrot not found.</p>' +
        '<a class="btn-secondary" href="' +
        escapeHtml(spaHref("/brainrots")) +
        '" data-spa-path="/brainrots">Back to catalog</a>' +
        "</div>";
      document.title = "Not found · " + BASE_TITLE;
      return;
    }

    var rc = rarityBadgeClass(b.rarity);
    var rarityBadgeText = formatRarityLabel(b.rarity);
    var sortedTypesForDetail =
      b.types && b.types.length ? sortTypeRowsByMultiplierAsc(b.types) : [];
    var initialTypeIdx = 0;
    var it;
    for (it = 0; it < sortedTypesForDetail.length; it++) {
      if ((sortedTypesForDetail[it].slug && String(sortedTypesForDetail[it].slug).trim()) === "default") {
        initialTypeIdx = it;
        break;
      }
    }
    var tInitial = sortedTypesForDetail.length ? sortedTypesForDetail[initialTypeIdx] : null;
    var heroTypeSlug = tInitial
      ? (tInitial.slug && String(tInitial.slug).trim()) || "default"
      : "default";
    var initialMult = getCatalogTypeMultiplier(heroTypeSlug);
    var initialIncomeStr = formatIncomePerSec(b.incomePerSec * initialMult);
    var initialTypeLabel = tInitial && tInitial.name != null ? String(tInitial.name) : "Default";
    var initialMetaStr = " · " + initialTypeLabel + " (" + formatMultiplier(initialMult) + "×)";

    var typesHtml = "";
    if (b.types && b.types.length) {
      typesHtml = sortedTypesForDetail
        .map(function (t, ti) {
          var typeSlug = (t.slug && String(t.slug).trim()) || "default";
          var mult = getCatalogTypeMultiplier(typeSlug);
          var mediaHtml = brainrotThumbMediaHtml(b.name, b, typeSlug, {
            imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas style-tile__img",
            fallbackClass: "style-tile__glyph",
          });
          var isAct = ti === initialTypeIdx;
          return (
            '<button type="button" class="style-tile style-tile--pick' +
            (isAct ? " is-active" : "") +
            '" data-type-slug="' +
            escapeHtml(typeSlug) +
            '" data-type-mult="' +
            escapeHtml(String(mult)) +
            '" aria-pressed="' +
            (isAct ? "true" : "false") +
            '" aria-label="' +
            escapeHtml("Show " + (t.name || typeSlug) + " in preview") +
            '">' +
            '<span class="style-tile__media brainrot-thumb">' +
            mediaHtml +
            "</span>" +
            '<span class="style-tile__label">' +
            escapeHtml(t.name) +
            "</span>" +
            '<span class="style-tile__mult">' +
            escapeHtml(formatMultiplier(mult)) +
            "×</span></button>"
          );
        })
        .join("");
    } else {
      var styles = b.styles && b.styles.length ? b.styles : [{ label: "Default", slug: b.slug, primary: true }];
      typesHtml = styles
        .map(function (st) {
          var active = st.slug === b.slug;
          var href = spaHref("/brainrots/" + encodeURIComponent(st.slug));
          return (
            '<a class="style-tile' +
            (active ? " is-active" : "") +
            '" href="' +
            escapeHtml(href) +
            '" data-spa-path="/brainrots/' +
            encodeURIComponent(st.slug) +
            '">' +
            '<span class="style-tile__glyph">' +
            escapeHtml(initialGlyph(b.name)) +
            "</span>" +
            '<span class="style-tile__label">' +
            escapeHtml(st.label) +
            "</span>" +
            "</a>"
          );
        })
        .join("");
    }

    var related = relatedBrainrots(b, 8);
    var relatedHtml = related
      .map(function (r) {
        var rrc = rarityBadgeClass(r.rarity);
        return (
          '<a class="related-tile" href="' +
          escapeHtml(spaHref("/brainrots/" + encodeURIComponent(r.slug))) +
          '" data-spa-path="/brainrots/' +
          encodeURIComponent(r.slug) +
          '">' +
          '<span class="related-tile__thumb brainrot-thumb">' +
          brainrotThumbMediaHtml(r.name, r, "default", {
            imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas related-tile__img",
            fallbackClass: "related-tile__glyph",
          }) +
          "</span>" +
          '<span class="related-tile__name">' +
          escapeHtml(r.name) +
          "</span>" +
          '<span class="brainrot-card__rarity ' +
          rrc +
          '">' +
          escapeHtml(formatRarityLabel(r.rarity)) +
          "</span>" +
          "</a>"
        );
      })
      .join("");

    var carpetRateVal = findCarpetRateForBrainrot(b);
    var hasCarpetRate =
      carpetRateVal !== null && carpetRateVal !== undefined && String(carpetRateVal).trim() !== "";
    var carpetRateRow = "";
    if (hasCarpetRate) {
      carpetRateRow =
        "<div><dt>Carpet rate</dt><dd>" +
        escapeHtml(String(carpetRateVal)) +
        '% <span class="detail-meta-hint">(roll weight in ' +
        escapeHtml(formatRarityLabel(b.rarity)) +
        ")</span></dd></div>";
    }

    var typeNavHtml =
      '<div class="detail-preview-actions" role="group" aria-label="Preview actions">' +
      '<div class="detail-preview-actions__side detail-preview-actions__side--left">' +
      (sortedTypesForDetail.length > 1
        ? '<button type="button" class="detail-type-nav__btn" id="detail-type-prev" aria-label="Previous type">' +
          '<span class="detail-type-nav__glyph" aria-hidden="true">\u2190</span>' +
          "</button>"
        : "") +
      "</div>" +
      '<button type="button" class="detail-save-icon-btn" id="detail-save-icon" aria-label="Download icon">Save</button>' +
      '<div class="detail-preview-actions__side detail-preview-actions__side--right">' +
      (sortedTypesForDetail.length > 1
        ? '<button type="button" class="detail-type-nav__btn" id="detail-type-next" aria-label="Next type">' +
          '<span class="detail-type-nav__glyph" aria-hidden="true">\u2192</span>' +
          "</button>"
        : "") +
      "</div>" +
      "</div>";

    var descRaw = b.description != null ? String(b.description).trim() : "";
    var brainrotDescriptionBlock = "";
    if (descRaw) {
      brainrotDescriptionBlock =
        '<p class="detail-brainrot-description">' +
        escapeHtml(descRaw).replace(/\n/g, "<br />") +
        "</p>";
    }

    root.innerHTML =
      '<div class="detail-inner">' +
      '<div class="detail-topnav">' +
      '<a class="btn-secondary detail-topback" href="' +
      escapeHtml(spaHref("/brainrots")) +
      '" data-spa-path="/brainrots">← All brainrots</a>' +
      "</div>" +
      '<div class="detail-layout">' +
      '<div class="detail-preview">' +
      '<div class="detail-preview__column">' +
      '<div id="detail-preview-stage" class="detail-preview__stage brainrot-thumb"' +
      (b.slug != null && String(b.slug).trim() !== ""
        ? ' data-brainrot-slug="' + escapeAttr(String(b.slug)) + '"'
        : "") +
      ">" +
      brainrotThumbMediaHtml(b.name, b, heroTypeSlug, {
        imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas detail-preview__img",
        fallbackClass: "detail-preview__glyph detail-preview__glyph--fallback",
      }) +
      "</div>" +
      typeNavHtml +
      "</div>" +
      "</div>" +
      '<div class="detail-info">' +
      '<h1 class="detail-title">' +
      escapeHtml(b.name.toUpperCase()) +
      "</h1>" +
      '<span class="brainrot-card__rarity detail-rarity-badge ' +
      rc +
      '">' +
      escapeHtml(rarityBadgeText) +
      "</span>" +
      brainrotTagsHtmlForUi(b) +
      '<dl class="detail-meta">' +
      "<div><dt>Price</dt><dd>" +
      escapeHtml(formatMoney(b.price)) +
      "</dd></div>" +
      "<div><dt>Base income</dt><dd><span id=\"detail-dd-income\">" +
      escapeHtml(initialIncomeStr) +
      '</span><span id="detail-income-type-meta" class="detail-meta-hint">' +
      escapeHtml(b.types && b.types.length ? initialMetaStr : "") +
      "</span></dd></div>" +
      "<div><dt>Rarity</dt><dd>" +
      escapeHtml(formatRarityLabel(b.rarity)) +
      "</dd></div>" +
      carpetRateRow +
      (typeof b.id === "number"
        ? "<div><dt>ID</dt><dd>" + escapeHtml(String(b.id)) + "</dd></div>"
        : "") +
      "</dl>" +
      brainrotDescriptionBlock +
      '<section class="detail-section detail-reaction-section" id="detail-reaction-section">' +
      "<h2>Reactions</h2>" +
      '<div class="detail-reaction-wrap" id="detail-reaction-root" data-slug="' +
      escapeAttr(String(b.slug)) +
      '">' +
      '<div id="detail-reaction-bar-host"></div>' +
      '<p class="detail-reaction-login-hint" id="detail-reaction-login-hint" hidden>Log in with Discord to react.</p>' +
      '<p class="detail-reaction-error" id="detail-reaction-error" hidden></p>' +
      "</div>" +
      "</section>" +
      (function () {
        var soundJson =
          b.sound != null && String(b.sound).trim() !== ""
            ? String(b.sound).trim()
            : brainrotDefaultSoundJsonPath(b);
        if (!soundJson) return "";
        var wavU = escapeAttr(soundWavPublicUrlFromJson(soundJson));
        var m4aU = escapeAttr(/\.m4a$/i.test(String(soundJson)) ? soundM4aPublicUrlFromJson(soundJson) : wavU);
        var inner =
          m4aU !== wavU
            ? '<source src="' +
              m4aU +
              '" type="audio/mp4"><source src="' +
              wavU +
              '" type="audio/wav">'
            : /\.m4a$/i.test(m4aU)
              ? '<source src="' + m4aU + '" type="audio/mp4">'
              : '<source src="' + wavU + '" type="audio/wav">';
        return (
          '<div class="detail-audio">' +
          "<h2 class=\"detail-audio__title\">Sound</h2>" +
          '<audio class="detail-audio__player" controls preload="none" playsinline="" webkit-playsinline="">' +
          inner +
          "Your browser does not support audio." +
          "</audio></div>"
        );
      })() +
      "</div>" +
      '<section class="detail-section detail-layout-span">' +
      "<h2>Types</h2>" +
      '<div class="style-tiles">' +
      typesHtml +
      "</div>" +
      "</section>" +
      (related.length
        ? '<section class="detail-section detail-layout-span">' +
          "<h2>More " +
          escapeHtml(formatRarityLabel(b.rarity)) +
          "</h2>" +
          '<div class="related-grid">' +
          relatedHtml +
          "</div>" +
          "</section>"
        : "") +
      "</div>" +
      "</div>";

    hydrateBrainrotAtlasProbes(root);
    wireBrainrotDetailSound(root);
    wireDetailTypePicker(root, b);
    wireDetailIconDownload(root, b);
    wireDetailRating(root, b);
    document.title = b.name + " - STB-Arab";
  }

  function wireBrainrotDetailSound(root) {
    var el = root.querySelector(".detail-audio__player");
    if (!el) return;
    if (el.getAttribute("data-detail-sound-wire") === "1") return;
    el.setAttribute("data-detail-sound-wire", "1");
    var wrap = root.querySelector(".detail-audio");
    var primed = false;
    function primeLoad() {
      if (primed) return;
      primed = true;
      try {
        if (el.preload !== "metadata") el.preload = "metadata";
        el.load();
      } catch (ePrime) {}
    }
    el.addEventListener("touchstart", primeLoad, { passive: true });
    el.addEventListener("pointerdown", primeLoad, { passive: true });
    el.addEventListener("click", primeLoad, { passive: true });
    if (wrap) {
      wrap.addEventListener("touchstart", primeLoad, { passive: true });
      wrap.addEventListener("pointerdown", primeLoad, { passive: true });
      wrap.addEventListener("click", primeLoad, { passive: true });
    }
  }

  function showLoadError(msg) {
    loadFailed = true;
    var load = $("#brainrot-load");
    if (load) {
      load.hidden = false;
      load.classList.add("is-error");
      load.textContent = msg;
    }
  }

  function formatFn360Players(n) {
    var x = typeof n === "number" ? n : parseInt(n, 10);
    if (x !== x || x < 0) return "";
    if (x >= 1000000) return (x / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (x >= 1000) return (x / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(x);
  }

  function formatFn360TaglineHtml(s) {
    return String(s || "")
      .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]\ufe0f?/gu, "")
      .split(/\r?\n/)
      .map(function (line) {
        return escapeHtml(line.trim());
      })
      .filter(Boolean)
      .slice(0, 6)
      .join("<br>");
  }

  function formatFn360LastUpdatedLabel(d) {
    if (!d) return "";
    var t = d.lastSyncDate != null ? d.lastSyncDate : d.metrics_updated_date;
    if (t == null) t = d.published;
    if (t == null) return "";
    var dt;
    if (typeof t === "number" && t === t) {
      dt = t > 1e12 ? new Date(t) : new Date(t * 1000);
    } else {
      try {
        dt = new Date(t);
      } catch (e) {
        return "";
      }
    }
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function copyTextToClipboard(text, onOk, onErr) {
    var t = text != null ? String(text) : "";
    if (!t) {
      if (onErr) onErr();
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(onOk, function () {
        copyTextToClipboardExec(t, onOk, onErr);
      });
      return;
    }
    copyTextToClipboardExec(t, onOk, onErr);
  }

  function copyTextToClipboardExec(t, onOk, onErr) {
    try {
      var el = document.createElement("textarea");
      el.value = t;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(el);
      if (ok && onOk) onOk();
      else if (onErr) onErr();
    } catch (e) {
      if (onErr) onErr();
    }
  }

  function renderHomeIslandFn360Banner(root, cfg, d) {
    var name = escapeHtml(d.name ? String(d.name) : "STEAL THE BRAINROT");
    var imgAlt = escapeAttr(d.name ? String(d.name) : "STEAL THE BRAINROT");
    var imgSrcRaw =
      d.image_url && String(d.image_url).trim()
        ? String(d.image_url).trim()
        : d.lobby_background_image_url && String(d.lobby_background_image_url).trim()
          ? String(d.lobby_background_image_url).trim()
          : "assets/fn360-island.jpeg";
    var imgSrc = imgSrcRaw ? escapeHtml(imgSrcRaw) : "";
    var lastUp = formatFn360LastUpdatedLabel(d);
    var ccuDisp = formatFn360Players(d.lastSyncCcu);
    var heroSub =
      ccuDisp && String(ccuDisp).length
        ? "~ " + ccuDisp + " players live"
        : "";
    var tags =
      Array.isArray(d.tags) && d.tags.length
        ? d.tags
            .map(function (t) {
              return escapeHtml(String(t));
            })
            .join(" · ")
        : "";
    var taglineH = d.tagline ? formatFn360TaglineHtml(d.tagline) : "";
    var codeRaw = cfg.fortniteIslandCode ? String(cfg.fortniteIslandCode).trim() : "";
    var codeStr = codeRaw ? escapeHtml(codeRaw) : "";
    var discoverRaw = cfg.fortniteIslandDiscoverUrl ? String(cfg.fortniteIslandDiscoverUrl).trim() : "";
    var discover = discoverRaw ? escapeHtml(discoverRaw) : "";

    var metaFr = [];
    if (d.owner_name) {
      var ow = "Creator: " + String(d.owner_name);
      if (d.owner_code) ow += " (@" + String(d.owner_code) + ")";
      metaFr.push(ow);
    }
    if (lastUp) metaFr.push("Last updated " + lastUp);
    var metaLine = metaFr.length ? escapeHtml(metaFr.join(" · ")) : "";

    var pills =
      '<div class="wiki-home__island-pills" role="group" aria-label="Quick links">' +
      '<a class="wiki-home__island-pill wiki-home__island-pill--primary" data-spa-path="/map" href="#">' +
      stbIconSvg("map", "wiki-home__island-pill-icon") +
      "<span>Interactive map</span></a>" +
      (discover
        ? '<a class="wiki-home__island-pill" href="' +
          discover +
          '" target="_blank" rel="noopener noreferrer">' +
          stbIconSvg("external", "wiki-home__island-pill-icon") +
          "<span>Epic / Discover</span></a>"
        : "") +
      "</div>";

    var heroStyle = imgSrcRaw
      ? ' style="--island-hero-bg:url(\'' + escapeAttr(imgSrcRaw) + '\')"'
      : "";
    root.innerHTML =
      '<article class="wiki-home__island-banner wiki-home__island-banner--feed">' +
      '<div class="wiki-home__island-feed-hero"' +
      heroStyle +
      ">" +
      (imgSrc
        ? '<img class="wiki-home__island-feed-hero-img" src="' +
          imgSrc +
          '" alt="' +
          imgAlt +
          '" loading="lazy" decoding="async" />'
        : "") +
      '<div class="wiki-home__island-feed-hero-scrim" aria-hidden="true"></div>' +
      '<div class="wiki-home__island-feed-hero-text">' +
      '<h2 class="wiki-home__island-title">' +
      name +
      "</h2>" +
      (heroSub ? '<p class="wiki-home__island-sub">' + escapeHtml(heroSub) + "</p>" : "") +
      "</div>" +
      "</div>" +
      '<div class="wiki-home__island-feed-body">' +
      (tags ? '<p class="wiki-home__island-tags">' + tags + "</p>" : "") +
      pills +
      (taglineH ? '<div class="wiki-home__island-tagline">' + taglineH + "</div>" : "") +
      (codeStr
        ? '<div class="wiki-home__island-code-wrap">' +
          '<span class="wiki-home__island-code-label">Island code</span>' +
          '<button type="button" class="wiki-home__island-code" translate="no" aria-label="Copy island code: ' +
          escapeAttr(codeRaw) +
          '">' +
          stbIconSvg("copy", "wiki-home__island-code-icon") +
          '<span class="wiki-home__island-code-text">' +
          codeStr +
          "</span></button></div>"
        : "") +
      (metaLine ? '<p class="wiki-home__island-meta">' + metaLine + "</p>" : "") +
      "</div>" +
      "</article>";

    if (codeRaw) {
      var codeBtn = root.querySelector(".wiki-home__island-code");
      if (codeBtn) {
        var labelCopy = "Copy island code to clipboard";
        codeBtn.setAttribute("title", labelCopy);
        function doCopy() {
          copyTextToClipboard(
            codeRaw,
            function () {
              var orig = codeBtn.innerHTML;
              codeBtn.setAttribute("aria-label", "Copied to clipboard");
              codeBtn.setAttribute("data-copied", "1");
              codeBtn.textContent = "Copied!";
              window.setTimeout(function () {
                codeBtn.innerHTML = orig;
                codeBtn.removeAttribute("data-copied");
                codeBtn.setAttribute("aria-label", "Copy island code: " + codeRaw);
              }, 1500);
            },
            function () {
              /* leave button unchanged */
            }
          );
        }
        codeBtn.addEventListener("click", function (e) {
          e.preventDefault();
          doCopy();
        });
      }
    }
  }

  function renderHomeIslandFallback(root, cfg) {
    var imgUrl =
      cfg.homeImage && String(cfg.homeImage).trim()
        ? resolveMapAssetUrl(String(cfg.homeImage).trim())
        : cfg.islandImage && String(cfg.islandImage).trim()
          ? resolveMapAssetUrl(String(cfg.islandImage).trim())
          : resolveMapAssetUrl("assets/fn360-island.jpeg");
    var code = cfg.fortniteIslandCode && String(cfg.fortniteIslandCode).trim();
    var note = cfg.fortniteIslandNote && String(cfg.fortniteIslandNote).trim();
    var discover = cfg.fortniteIslandDiscoverUrl && String(cfg.fortniteIslandDiscoverUrl).trim();
    var parts = [];
    parts.push('<div class="wiki-home__map-card wiki-home__map-card--fallback">');
    parts.push('<p class="wiki-home__map-kicker">STEAL THE BRAINROT · Fortnite island</p>');
    if (imgUrl) {
      parts.push(
        '<a class="wiki-home__map-thumb-wrap" data-spa-path="/map" href="#" title="Open Collection">' +
          '<img class="wiki-home__map-thumb" src="' +
          escapeHtml(imgUrl) +
          '" alt="Map overview" loading="lazy" decoding="async" onerror="this.classList.add(\'is-broken\')" />' +
          '<span class="wiki-home__map-thumb-fallback" aria-hidden="true">Island art</span>' +
          "</a>"
      );
    }
    if (code) {
      parts.push('<div class="wiki-home__map-code-block">');
      parts.push('<span class="wiki-home__map-code-label">Island code</span>');
      parts.push('<code class="wiki-home__map-code" translate="no">' + escapeHtml(code) + "</code>");
      parts.push("</div>");
    }
    if (discover) {
      parts.push(
        '<a class="wiki-home__map-discover" href="' +
          escapeHtml(discover) +
          '" target="_blank" rel="noopener noreferrer">' +
          stbIconSvg("external", "wiki-home__map-discover-icon") +
          "<span>Open on fortnite.com</span></a>"
      );
    }
    if (note) {
      parts.push('<p class="wiki-home__map-note">' + escapeHtml(note) + "</p>");
    }
    parts.push(
      '<p class="wiki-home__map-fallback-hint">Live island artwork loads when FN360 is reachable (run npm start or use the deployed site).</p>'
    );
    parts.push("</div>");
    root.innerHTML = parts.join("");
  }

  function renderHomeIslandSection() {
    var root = document.getElementById("wiki-home-island-root");
    if (!root) return;
    if (!MAP_PAGE_PAYLOAD) {
      root.innerHTML =
        '<div class="wiki-home__island-fallback"><p class="wiki-home__map-placeholder">Loading map data&hellip;</p></div>';
      return;
    }
    var cfg = MAP_PAGE_PAYLOAD;
    var code = cfg.fortniteIslandCode && String(cfg.fortniteIslandCode).trim();
    root.innerHTML =
      '<div class="wiki-home__island-banner wiki-home__island-banner--loading" aria-busy="true">' +
      '<div class="wiki-home__island-banner-skeleton"></div>' +
      '<p class="wiki-home__island-loading-msg">Loading island art & live info (FN360)&hellip;</p>' +
      "</div>";

    var apiBase = siteApiUrl("api/fn360-map");
    if (!apiBase || !code) {
      renderHomeIslandFallback(root, cfg);
      return;
    }
    fetch(apiBase + "?code=" + encodeURIComponent(code), { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        var d = j && j.success && j.data ? j.data : null;
        if (d && d.image_url && String(d.image_url).trim() !== "") {
          renderHomeIslandFn360Banner(root, cfg, d);
        } else {
          renderHomeIslandFallback(root, cfg);
        }
      })
      .catch(function () {
        renderHomeIslandFallback(root, cfg);
      });
  }

  function renderRoute() {
    maybeStartLazyDataLoads();
    if (!catalogReady) {
      var pathEarly = getPath();
      var routeEarly = parseRoute(pathEarly);
      updateNavActive(routeEarly);
      setMainLayoutForRoute(routeEarly);
      if (routeEarly.view === "home") {
        showView("home");
        document.title = BASE_TITLE;
        window.scrollTo(0, 0);
        renderHomeIslandSection();
        return;
      }
      if (routeEarly.view === "settings") {
        showView("settings");
        document.title = "Settings · " + BASE_TITLE;
        window.scrollTo(0, 0);
        renderSettingsPage();
        return;
      }
      if (routeEarly.view === "credits") {
        showView("credits");
        document.title = creditsDocumentTitle();
        window.scrollTo(0, 0);
        renderCreditsPage();
        return;
      }
      if (routeEarly.view === "map") {
        showView("map");
        renderMapPage();
        document.title = "Map · " + BASE_TITLE;
        if (routeEarly.focusMap) scrollMapIntoView();
        return;
      }
      if (routeEarly.view === "rebirth") {
        if (rebirthGadgetsReady) {
          showView("rebirth");
          renderRebirth();
          document.title = rebirthDocumentTitle();
          return;
        }
        showView("rebirth");
        var rr = $("#rebirth-root");
        if (rr) rr.innerHTML = '<div class="rebirth-inner"><p class="loading-state">Loading…</p></div>';
        document.title = rebirthDocumentTitle();
        return;
      }
      if (routeEarly.view === "luckyrots") {
        if (luckyDataReady) {
          showView("luckyrots");
          renderLuckyRots();
          document.title = luckyRotsPageTitle() + " · " + BASE_TITLE;
          return;
        }
        showView("luckyrots");
        var lr = $("#luckyrots-root");
        if (lr) lr.innerHTML = '<div class="lucky-inner"><p class="loading-state">Loading…</p></div>';
        document.title = luckyRotsPageTitle() + " · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "traits") {
        if (traitsDataReady) {
          showView("traits");
          renderTraits();
          document.title = "Traits Mult · " + BASE_TITLE;
          return;
        }
        showView("traits");
        var tr = $("#traits-root");
        if (tr) tr.innerHTML = '<div class="traits-inner"><p class="loading-state">Loading…</p></div>';
        document.title = "Traits Mult · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "llamarots") {
        if (llamaDataReady) {
          showView("llamarots");
          renderLlamaRots();
          document.title = llamaRotsPageTitle() + " · " + BASE_TITLE;
          return;
        }
        showView("llamarots");
        var lr2 = $("#llamarots-root");
        if (lr2) lr2.innerHTML = '<div class="llama-inner"><p class="loading-state">Loading…</p></div>';
        document.title = llamaRotsPageTitle() + " · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "income") {
        showView("income");
        var inc = $("#income-root");
        if (inc) inc.innerHTML = '<div class="income-inner"><p class="loading-state">Loading catalog…</p></div>';
        document.title = "Income Calculator · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "type-mults") {
        showView("type-mults");
        var tmr = $("#type-mults-root");
        if (tmr) {
          tmr.innerHTML =
            '<div class="traits-inner"><p class="loading-state">Loading type multipliers…</p></div>';
        }
        document.title = "Type mults · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "spawn-rates") {
        showView("spawn-rates");
        document.title = spawnRatesDocumentTitle();
        var spEarly = $("#spawn-rates-rarity");
        if (spEarly) {
          spEarly.innerHTML =
            '<p class="loading-state">Loading spawn tables…</p>';
        }
        var stEarly = $("#spawn-rates-type");
        if (stEarly) {
          stEarly.innerHTML =
            '<p class="loading-state">Loading spawn tables…</p>';
        }
        return;
      }
      if (routeEarly.view === "boxrots") {
        if (boxRotsDataReady) {
          showView("boxrots");
          renderBoxRots();
          document.title = boxRotsPageTitle() + " · " + BASE_TITLE;
          return;
        }
        showView("boxrots");
        var brEarly = $("#boxrots-root");
        if (brEarly) {
          brEarly.innerHTML =
            '<div class="boxrots-inner"><p class="loading-state">Loading box rot rates…</p></div>';
        }
        document.title = boxRotsPageTitle() + " · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "wheel") {
        if (wheelDataReady) {
          showView("wheel");
          renderWheel();
          document.title = wheelPageTitle() + " · " + BASE_TITLE;
          return;
        }
        showView("wheel");
        var whEarly = $("#wheel-root");
        if (whEarly) {
          whEarly.innerHTML =
            '<div class="boxrots-inner"><p class="loading-state">' +
            escapeHtml(translationTx("wheelPage.loading", "Loading wheel rates…")) +
            "</p></div>";
        }
        document.title = wheelPageTitle() + " · " + BASE_TITLE;
        return;
      }
      if (routeEarly.view === "brainrots") {
        showView("brainrots");
        var lbEarly = $("#brainrot-load");
        if (lbEarly) lbEarly.hidden = false;
        document.title = brainrotsDocumentTitle();
        window.scrollTo(0, 0);
        return;
      } else if (routeEarly.view === "detail") {
        showView("detail");
        var dr = $("#detail-root");
        if (dr) dr.innerHTML = '<p class="loading-state">Loading catalog…</p>';
        document.title = translationTx("brainrotsPage.docTitle", "Brainrots") + " · " + BASE_TITLE;
        window.scrollTo(0, 0);
        return;
      } else if (routeEarly.view === "collection") {
        showView("collection");
        var croot = $("#collection-root");
        if (croot) {
          croot.innerHTML =
            '<div class="collection-inner"><p class="loading-state">Loading catalog…</p></div>';
        }
        document.title = collectionDocumentTitle();
      } else if (routeEarly.view === "events") {
        showView("events");
        if (eventsApi && eventsApi.renderEventsPageRoute) {
          var eventsRootEarly = $("#events-root");
          eventsApi.renderEventsPageRoute({
            soft: !!(eventsRootEarly && eventsRootEarly.querySelector(".events-live, .events-table-wrap")),
          });
        }
        document.title = eventsDocumentTitle();
        window.scrollTo(0, 0);
        return;
      } else if (routeEarly.view === "codes") {
        if (codesDataReady) {
          showView("codes");
          ensureCodesPageHandlers();
          renderCodes();
          document.title = codesDocumentTitle();
          return;
        }
        showView("codes");
        var codesRootEarly = $("#codes-root");
        if (codesRootEarly) {
          codesRootEarly.innerHTML =
            '<div class="codes-inner"><p class="loading-state">Loading codes…</p></div>';
        }
        document.title = codesDocumentTitle();
        return;
      } else if (routeEarly.view === "credits") {
        showView("credits");
        document.title = creditsDocumentTitle();
        renderCreditsPage();
        return;
      } else if (routeEarly.view === "blog") {
        showView("blog");
        ensureBlogPageHandlers();
        renderBlogPage();
        fetchBlogPosts(false);
        document.title = blogDocumentTitle();
        return;
      } else if (routeEarly.view === "blog-detail" && routeEarly.postId) {
        showView("blog-detail");
        BLOG_DETAIL = null;
        BLOG_DETAIL_ERROR = "";
        renderBlogDetailPage(routeEarly.postId);
        fetchBlogPostById(routeEarly.postId, false);
        document.title = blogDocumentTitle();
        return;
      } else if (routeEarly.view === "notfound") {
        showView("notfound");
        renderNotFound(routeEarly);
      } else if (routeEarly.view === "stats") {
        showView("stats");
        document.title = statsDocumentTitle();
        renderStats();
      } else if (routeEarly.view === "shop") {
        showView("shop");
        document.title = shopDocumentTitle();
        renderShopPage();
        window.scrollTo(0, 0);
        return;
      } else if (routeEarly.view === "admin-machine") {
        showView("admin-machine");
        document.title = adminMachineDocumentTitle();
        renderAdminMachinePanel();
      } else if (routeEarly.view === "eternal-machine") {
        showView("eternal-machine");
        document.title = eternalMachineDocumentTitle();
        if (catalogReady) {
          renderEternalMachine();
        } else {
          var emr = $("#eternal-machine-root");
          if (emr) {
            emr.innerHTML =
              '<div class="eternal-machine"><p class="loading-state">' +
              escapeHtml(translationTx("brainrotsPage.loadingCatalog", "Loading catalog…")) +
              "</p></div>";
          }
        }
      } else {
        showView("home");
        document.title = BASE_TITLE;
        renderHomeIslandSection();
      }
      return;
    }

    var path = getPath();
    var route = parseRoute(path);
    updateNavActive(route);
    setMainLayoutForRoute(route);

    if (route.view === "home") {
      showView("home");
      document.title = BASE_TITLE;
      window.scrollTo(0, 0);
      renderHomeIslandSection();
      return;
    }

    if (route.view === "map") {
      showView("map");
      renderMapPage();
      document.title = "Map · " + BASE_TITLE;
      if (route.focusMap) scrollMapIntoView();
      else window.scrollTo(0, 0);
      return;
    }

    if (route.view === "credits") {
      showView("credits");
      document.title = creditsDocumentTitle();
      renderCreditsPage();
      return;
    }

    var vbBeforeRoute = $("#view-brainrots");
    if (
      route.view === "detail" &&
      route.slug &&
      vbBeforeRoute &&
      !vbBeforeRoute.hidden
    ) {
      BRAINROTS_CATALOG_SCROLL_RESTORE_Y =
        typeof window.scrollY === "number" ? window.scrollY : 0;
    }

    window.scrollTo(0, 0);

    if (route.view === "stats") {
      showView("stats");
      renderStats();
      document.title = statsDocumentTitle();
      return;
    }

    if (route.view === "admin-machine") {
      showView("admin-machine");
      renderAdminMachinePanel();
      document.title = adminMachineDocumentTitle();
      return;
    }

    if (route.view === "eternal-machine") {
      showView("eternal-machine");
      renderEternalMachine();
      document.title = eternalMachineDocumentTitle();
      return;
    }

    if (route.view === "shop") {
      showView("shop");
      renderShopPage();
      document.title = shopDocumentTitle();
      return;
    }

    if (route.view === "rebirth") {
      showView("rebirth");
      renderRebirth();
      document.title = rebirthDocumentTitle();
      return;
    }

    if (route.view === "luckyrots") {
      showView("luckyrots");
      renderLuckyRots();
      document.title = luckyRotsPageTitle() + " · " + BASE_TITLE;
      return;
    }

    if (route.view === "traits") {
      showView("traits");
      renderTraits();
      document.title = "Traits Mult · " + BASE_TITLE;
      return;
    }

    if (route.view === "income") {
      showView("income");
      renderIncomeCalculator();
      document.title = "Income Calculator · " + BASE_TITLE;
      return;
    }

    if (route.view === "type-mults") {
      showView("type-mults");
      renderTypeMultsPage();
      document.title =
        (TYPE_MULTS_PAYLOAD && TYPE_MULTS_PAYLOAD.label
          ? String(TYPE_MULTS_PAYLOAD.label)
          : "Type mults") +
        " · " +
        BASE_TITLE;
      return;
    }

    if (route.view === "llamarots") {
      showView("llamarots");
      renderLlamaRots();
      document.title = llamaRotsPageTitle() + " · " + BASE_TITLE;
      return;
    }

    if (route.view === "brainrots") {
      showView("brainrots");
      document.title = brainrotsDocumentTitle();
      applyBrainrotsPageLastUpdated();
      if (BRAINROTS.length) {
        fillRarityFilter();
        renderBrainrots(getFilteredBrainrots());
      }
      if (BRAINROTS_CATALOG_SCROLL_RESTORE_Y !== null) {
        var restoreY = BRAINROTS_CATALOG_SCROLL_RESTORE_Y;
        BRAINROTS_CATALOG_SCROLL_RESTORE_Y = null;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            window.scrollTo(0, restoreY);
          });
        });
      }
      return;
    }

    if (route.view === "spawn-rates") {
      showView("spawn-rates");
      document.title = spawnRatesDocumentTitle();
      spawnRatesApi.renderSpawnRatesPage();
      return;
    }

    if (route.view === "boxrots") {
      showView("boxrots");
      renderBoxRots();
      document.title = boxRotsPageTitle() + " · " + BASE_TITLE;
      return;
    }

    if (route.view === "wheel") {
      showView("wheel");
      renderWheel();
      document.title = wheelPageTitle() + " · " + BASE_TITLE;
      return;
    }

    if (route.view === "detail" && route.slug) {
      showView("detail");
      renderDetail(route.slug);
      return;
    }

    if (route.view === "settings") {
      showView("settings");
      document.title = "Settings · " + BASE_TITLE;
      window.scrollTo(0, 0);
      renderSettingsPage();
      return;
    }

    if (route.view === "collection") {
      showView("collection");
      renderCollectionPage();
      return;
    }

    if (route.view === "codes") {
      showView("codes");
      ensureCodesPageHandlers();
      renderCodes();
      document.title = codesDocumentTitle();
      return;
    }

    if (route.view === "events") {
      showView("events");
      if (eventsApi && eventsApi.renderEventsPageRoute) {
        var eventsRoot = $("#events-root");
        eventsApi.renderEventsPageRoute({
          soft: !!(eventsRoot && eventsRoot.querySelector(".events-live, .events-table-wrap")),
        });
      }
      document.title = eventsDocumentTitle();
      window.scrollTo(0, 0);
      return;
    }

    if (route.view === "blog") {
      showView("blog");
      ensureBlogPageHandlers();
      renderBlogPage();
      fetchBlogPosts(false);
      document.title = blogDocumentTitle();
      return;
    }

    if (route.view === "blog-detail" && route.postId) {
      showView("blog-detail");
      BLOG_DETAIL = null;
      BLOG_DETAIL_ERROR = "";
      renderBlogDetailPage(route.postId);
      fetchBlogPostById(route.postId, false);
      document.title = blogDocumentTitle();
      return;
    }

    if (route.view === "notfound") {
      showView("notfound");
      renderNotFound(route);
      return;
    }

    showView("home");
    document.title = BASE_TITLE;
  }

  function wireUi() {
    ensureBrainrotTagFilterUi();
    if (brainrotFiltersWired) return;
    brainrotFiltersWired = true;
    var search = $("#brainrot-search");
    var filter = $("#rarity-filter");
    var sort = $("#brainrot-sort");
    function refresh() {
      var path = getPath();
      var route = parseRoute(path);
      if (route.view === "brainrots") {
        renderBrainrots(getFilteredBrainrots());
      }
    }
    if (search) search.addEventListener("input", refresh);
    if (filter) filter.addEventListener("change", refresh);
    if (sort) sort.addEventListener("change", refresh);
  }

  var spaListenersAttached = false;

  function attachSpaListeners() {
    if (spaListenersAttached) return;
    spaListenersAttached = true;

    /** Capture phase: runs before inner handlers that might stopPropagation on bubble. */
    document.addEventListener(
      "click",
      function (e) {
        var node = e.target;
        while (node && node.nodeType !== 1) {
          node = node.parentNode;
        }
        if (!node || typeof node.closest !== "function") return;
        var a = node.closest("a[data-spa-path]");
        if (!a) return;
        var spaPath = a.getAttribute("data-spa-path") || "";
        e.preventDefault();
        e.stopPropagation();
        navigate(spaPath);
      },
      true
    );

    window.addEventListener("popstate", renderRoute);
    window.addEventListener("hashchange", renderRoute);
  }

  function siteApiUrl(apiPath) {
    if (USE_HASH) return "";
    var prefix = getAppPathPrefix();
    var p = String(apiPath || "").replace(/^\/+/, "");
    if (prefix) {
      return prefix.replace(/\/$/, "") + "/" + p;
    }
    return "/" + p;
  }

  function adminMachineApiUrl() {
    var custom =
      typeof window.STBARAB_ADMIN_MACHINE_API_URL === "string" ? window.STBARAB_ADMIN_MACHINE_API_URL.trim() : "";
    if (custom) return custom.replace(/\/$/, "");
    if (location.protocol !== "http:" && location.protocol !== "https:") return "";
    var prefix = getAppPathPrefix();
    var tail = "api/admin-machine";
    if (prefix) return prefix.replace(/\/$/, "") + "/" + tail;
    return "/" + tail;
  }

  function applyHeaderApiLinks() {
    var prefix = getAppPathPrefix();
    var p = prefix ? prefix.replace(/\/$/, "") : "";
    var login = document.querySelector(".header-user__login");
    var logout = document.querySelector('a.header-user__menu-item[href="/api/auth/logout"]');
    if (login) login.href = p + "/api/auth/discord";
    if (logout) logout.href = p + "/api/auth/logout";
  }

  function wireHeaderUserDropdown() {
    var logged = document.getElementById("header-user-logged");
    var trigger = document.getElementById("header-user-trigger");
    if (!logged || !trigger) return;
    function closeUserMenu() {
      logged.classList.remove("header-user__logged--open");
      trigger.setAttribute("aria-expanded", "false");
    }
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      logged.classList.toggle("header-user__logged--open");
      trigger.setAttribute(
        "aria-expanded",
        logged.classList.contains("header-user__logged--open") ? "true" : "false"
      );
    });
    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!logged.classList.contains("header-user__logged--open")) return;
        if (logged.contains(e.target)) return;
        closeUserMenu();
      },
      true
    );
    logged.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  function wireSiteBrandMega() {
    var brand = document.getElementById("site-brand");
    var toggle = document.getElementById("site-brand-toggle");
    if (!brand || !toggle) return;

    function closeMega() {
      brand.classList.remove("site-brand--open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      brand.classList.toggle("site-brand--open");
      toggle.setAttribute(
        "aria-expanded",
        brand.classList.contains("site-brand--open") ? "true" : "false"
      );
    });

    brand.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    document.addEventListener("click", closeMega);
  }

  function wireMainNavMobileDropdowns() {
    var nav = document.querySelector(".main-nav");
    var navScroll = document.querySelector(".main-nav__scroll");
    var header = document.querySelector(".site-header");
    if (!nav || !navScroll) return;
    nav.querySelectorAll(".main-nav__dropdown").forEach(function (dd) {
      if (!dd.__navDropMenu)
        dd.__navDropMenu = dd.querySelector(".main-nav__dropdown-menu");
    });
    var mq = window.matchMedia("(max-width: 720px)");
    var driftPx = 8;
    function clearMenuStyles(menu) {
      menu.style.removeProperty("position");
      menu.style.removeProperty("top");
      menu.style.removeProperty("left");
      menu.style.removeProperty("right");
      menu.style.removeProperty("width");
      menu.style.removeProperty("max-width");
    }
    function restoreDropdownMenu(dd, menu) {
      if (menu.parentNode !== document.body) {
        dd.__navDropPortal = null;
        return;
      }
      try {
        if (dd.__navDropPortal && dd.__navDropPortal.parent) {
          dd.__navDropPortal.parent.insertBefore(menu, dd.__navDropPortal.next);
        } else if (menu.parentNode === document.body) {
          dd.appendChild(menu);
        }
      } catch (exRestore) {}
      dd.__navDropPortal = null;
      menu.classList.remove("main-nav__dropdown-menu--portaled");
    }
    function clearMobileDropdownOpen() {
      if (mq.matches) return;
      document.querySelectorAll(".main-nav__dropdown--open").forEach(function (dd) {
        dd.classList.remove("main-nav__dropdown--open");
      });
    }
    function layoutDropdownMenus() {
      if (!mq.matches) {
        nav.querySelectorAll(".main-nav__dropdown").forEach(function (dd) {
          var menu = dd.__navDropMenu;
          if (!menu) return;
          restoreDropdownMenu(dd, menu);
          clearMenuStyles(menu);
        });
        clearMobileDropdownOpen();
        if (header) header.classList.remove("site-header--nav-drift");
        return;
      }
      nav.querySelectorAll(".main-nav__dropdown").forEach(function (dd) {
        var menu = dd.__navDropMenu;
        if (!menu) return;
        var open =
          dd.matches(":focus-within") ||
          dd.matches(":hover") ||
          dd.classList.contains("main-nav__dropdown--open");
        if (!open) {
          restoreDropdownMenu(dd, menu);
          clearMenuStyles(menu);
          return;
        }
        if (menu.parentNode !== document.body) {
          dd.__navDropPortal = {
            parent: menu.parentNode,
            next: menu.nextSibling,
          };
          document.body.appendChild(menu);
          menu.classList.add("main-nav__dropdown-menu--portaled");
        }
        var tr = dd.getBoundingClientRect();
        var gap = 6;
        var vw = window.innerWidth;
        var maxW = Math.min(288, vw - 16);
        menu.style.position = "fixed";
        menu.style.top = tr.bottom + gap + "px";
        menu.style.width = maxW + "px";
        menu.style.maxWidth = maxW + "px";
        menu.style.right = "auto";
        var center = tr.left + tr.width / 2 - maxW / 2;
        var left = Math.max(8, Math.min(center, vw - maxW - 8));
        menu.style.left = left + "px";
      });
    }
    function mainNavDropdownPointerHit(t) {
      if (!t || !t.closest) return false;
      if (t.closest(".main-nav__dropdown-menu")) return true;
      if (t.closest(".main-nav__dropdown")) return true;
      return false;
    }
    function syncNavStripScrollState() {
      if (!header) return;
      if (!mq.matches) {
        header.classList.remove("site-header--nav-drift");
        return;
      }
      if (navScroll.scrollLeft > driftPx) header.classList.add("site-header--nav-drift");
      else header.classList.remove("site-header--nav-drift");
    }
    function onNavScrollStrip() {
      syncNavStripScrollState();
      layoutDropdownMenus();
    }
    mq.addEventListener("change", function () {
      clearMobileDropdownOpen();
      onNavScrollStrip();
    });
    navScroll.addEventListener("scroll", onNavScrollStrip, { passive: true });
    window.addEventListener("resize", onNavScrollStrip);
    nav.addEventListener("pointerdown", layoutDropdownMenus, true);
    document.addEventListener(
      "focusin",
      function (e) {
        if (nav.contains(e.target)) layoutDropdownMenus();
      },
      true
    );
    document.addEventListener(
      "focusout",
      function (e) {
        if (nav.contains(e.target)) setTimeout(layoutDropdownMenus, 80);
      },
      true
    );
    nav.querySelectorAll(".main-nav__dropdown").forEach(function (dd) {
      var trigger = dd.querySelector(":scope > a.nav-tab");
      if (!trigger || trigger.getAttribute("data-mnav-dd") === "1") return;
      trigger.setAttribute("data-mnav-dd", "1");
      trigger.addEventListener(
        "click",
        function (e) {
          if (!mq.matches) return;
          var wasOpen = dd.classList.contains("main-nav__dropdown--open");
          document.querySelectorAll(".main-nav__dropdown--open").forEach(function (o) {
            if (o !== dd) o.classList.remove("main-nav__dropdown--open");
          });
          if (!wasOpen) {
            e.preventDefault();
            e.stopPropagation();
            dd.classList.add("main-nav__dropdown--open");
            layoutDropdownMenus();
          } else {
            dd.classList.remove("main-nav__dropdown--open");
            layoutDropdownMenus();
          }
        },
        true
      );
    });
    nav.querySelectorAll(".main-nav__dropdown-item").forEach(function (item) {
      if (item.getAttribute("data-mnav-close") === "1") return;
      item.setAttribute("data-mnav-close", "1");
      item.addEventListener("click", function () {
        if (!mq.matches) return;
        document.querySelectorAll(".main-nav__dropdown--open").forEach(function (ddOpen) {
          ddOpen.classList.remove("main-nav__dropdown--open");
        });
        layoutDropdownMenus();
      });
    });
    document.addEventListener("click", function (e) {
      if (!mq.matches) return;
      if (mainNavDropdownPointerHit(e.target)) return;
      document.querySelectorAll(".main-nav__dropdown--open").forEach(function (dd2) {
        dd2.classList.remove("main-nav__dropdown--open");
      });
      layoutDropdownMenus();
    });
    document.addEventListener(
      "touchend",
      function (e) {
        if (!mq.matches) return;
        if (mainNavDropdownPointerHit(e.target)) return;
        document.querySelectorAll(".main-nav__dropdown--open").forEach(function (dd3) {
          dd3.classList.remove("main-nav__dropdown--open");
        });
        layoutDropdownMenus();
      },
      { passive: true },
    );
    document.addEventListener("keydown", function (e) {
      if (!mq.matches || e.key !== "Escape") return;
      document.querySelectorAll(".main-nav__dropdown--open").forEach(function (dd) {
        dd.classList.remove("main-nav__dropdown--open");
      });
      layoutDropdownMenus();
    });
    onNavScrollStrip();
  }

  /** Remove <code>?auth=</code> after OAuth redirect so the address bar stays clean. */
  function stripAuthQueryFromUrl() {
    try {
      if (USE_HASH) {
        var raw = location.hash.replace(/^#/, "");
        var qi = raw.indexOf("?");
        if (qi < 0) return;
        var pathPart = raw.slice(0, qi);
        var sp = new URLSearchParams(raw.slice(qi + 1));
        if (!sp.has("auth")) return;
        sp.delete("auth");
        var q = sp.toString();
        var newHash = "#" + pathPart + (q ? "?" + q : "");
        history.replaceState(null, "", location.pathname + location.search + newHash);
        return;
      }
      var u = new URL(location.href);
      if (!u.searchParams.has("auth")) return;
      u.searchParams.delete("auth");
      var qs = u.searchParams.toString();
      history.replaceState(null, "", u.pathname + (qs ? "?" + qs : "") + u.hash);
    } catch (e) {}
  }

  function refreshHeaderAuth() {
    var guest = document.getElementById("header-user-guest");
    var logged = document.getElementById("header-user-logged");
    var avatar = document.getElementById("header-user-avatar");
    var nameEl = document.getElementById("header-user-name");
    var discEl = document.getElementById("header-user-discriminator");
    var trigger = document.getElementById("header-user-trigger");
    if (!guest || !logged) return;

    var api = siteApiUrl("api/me");
    if (!api) {
      guest.hidden = false;
      logged.hidden = true;
      maybeRefreshCodesPage();
      return;
    }

    fetch(api, { credentials: "include" })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.user) {
          guest.hidden = true;
          logged.hidden = false;
          if (nameEl) nameEl.textContent = j.user.username || j.user.name || "User";
          if (avatar) {
            var au = String(j.user.avatarUrl || "").trim();
            avatar.referrerPolicy = "no-referrer";
            if (
              au.indexOf("https://cdn.discordapp.com/avatars/") === 0 ||
              au.indexOf("https://cdn.discordapp.com/embed/avatars/") === 0 ||
              au.indexOf("https://media.discordapp.net/avatars/") === 0 ||
              au.indexOf("https://media.discordapp.net/embed/avatars/") === 0
            ) {
              avatar.src = au;
            } else {
              avatar.src = assetUrlPath("assets/stb-arab-logo.png");
            }
            avatar.alt = "";
          }
          if (discEl) {
            var d = j.user.discriminator;
            if (d && String(d) !== "0") discEl.textContent = "#" + d;
            else discEl.textContent = translationTx("header.connectedAccount", "Connected account");
          }
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        } else {
          guest.hidden = false;
          logged.hidden = true;
        }
        maybeRefreshCodesPage();
      })
      .catch(function () {
        guest.hidden = false;
        logged.hidden = true;
        maybeRefreshCodesPage();
      });
  }

  window.STBARAB_REFRESH_HEADER_AUTH = refreshHeaderAuth;
  window.STBARAB_TRANSLATION_GET = translationGet;
  window.STBARAB_TRANSLATION_TX = translationTx;
  window.STBARAB_SITE_API = siteApiUrl;
  window.STBARAB_ADMIN_MACHINE_API = adminMachineApiUrl;

  function applyAdminMachineLiveFromBoot(body) {
    if (!body || !body.ok || !body.preview) return false;
    var serverSec =
      typeof body.serverTimeSec === "number" && body.serverTimeSec === body.serverTimeSec
        ? body.serverTimeSec
        : Math.floor(Date.now() / 1000);
    ADMIN_MACHINE_PREVIEW = body.preview;
    ADMIN_MACHINE_SERVER_OFFSET_SEC = serverSec - Math.floor(Date.now() / 1000);
    var cd = body.countdown && typeof body.countdown === "object" ? body.countdown : {};
    var cdSec = typeof cd.seconds === "number" ? cd.seconds : 0;
    ADMIN_MACHINE_PREVIEW_BOUNDARY_UNIX = serverSec + cdSec;
    ADMIN_MACHINE_COUNTDOWN_LABEL =
      typeof cd.label === "string" && cd.label.trim() !== ""
        ? cd.label
        : "Next rotation starts in";
    ADMIN_MACHINE_API_MODE = true;
    adminMachinePreviewKey = "";
    ensureAdminMachineTimer();
    return true;
  }

  function loadAdminMachineReferenceOnly() {
    if (ADMIN_MACHINE_REF && ADMIN_MACHINE_ICONS_PAYLOAD) {
      adminMachinePreviewKey = "";
      ensureAdminMachineTimer();
      return Promise.resolve();
    }
    var refP = fetch(dataJsonUrl("data/admin_machine_reference.json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    var iconsP = fetch(dataJsonUrl("data/admin_machine_icons.json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    return Promise.all([refP, iconsP]).then(function (pair) {
      var ref = pair[0];
      var icons = pair[1];
      ADMIN_MACHINE_API_MODE = false;
      ADMIN_MACHINE_PREVIEW = null;
      ADMIN_MACHINE_SERVER_OFFSET_SEC = 0;
      ADMIN_MACHINE_PREVIEW_BOUNDARY_UNIX = 0;
      if (ref) ADMIN_MACHINE_REF = ref;
      ADMIN_MACHINE_ICONS_PAYLOAD = icons;
      adminMachinePreviewKey = "";
      ensureAdminMachineTimer();
    });
  }

  function loadAdminMachineData() {
    var url = adminMachineApiUrl();
    if (!url) {
      return loadAdminMachineReferenceOnly();
    }
    var refP = fetch(dataJsonUrl("data/admin_machine_reference.json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    var iconsP = fetch(dataJsonUrl("data/admin_machine_icons.json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    return Promise.all([
      fetch(url, { cache: "no-store", credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("admin-machine api");
        return r.json();
      }),
      refP,
      iconsP,
    ])
      .then(function (triple) {
        var body = triple[0];
        var ref = triple[1];
        var icons = triple[2];
        if (!body || !body.ok || !body.preview) throw new Error("admin-machine api");
        ADMIN_MACHINE_REF = ref;
        ADMIN_MACHINE_ICONS_PAYLOAD = icons;
        ADMIN_MACHINE_PREVIEW = body.preview;
        var serverSec =
          typeof body.serverTimeSec === "number"
            ? body.serverTimeSec
            : Math.floor(Date.now() / 1000);
        ADMIN_MACHINE_SERVER_OFFSET_SEC = serverSec - Math.floor(Date.now() / 1000);
        var cd = body.countdown && typeof body.countdown === "object" ? body.countdown : {};
        var cdSec = typeof cd.seconds === "number" ? cd.seconds : 0;
        ADMIN_MACHINE_PREVIEW_BOUNDARY_UNIX = serverSec + cdSec;
        ADMIN_MACHINE_COUNTDOWN_LABEL =
          typeof cd.label === "string" && cd.label.trim() !== ""
            ? cd.label
            : "Next rotation starts in";
        ADMIN_MACHINE_API_MODE = true;
        adminMachinePreviewKey = "";
        ensureAdminMachineTimer();
      })
      .catch(function () {
        if (url) {
          console.warn(
            "STBARAB: GET /api/admin-machine failed; loading reference + icons only."
          );
        }
        return loadAdminMachineReferenceOnly();
      });
  }

  function decodeBootB64(b64) {
    var bin = atob(String(b64).replace(/\s+/g, ""));
    if (typeof TextDecoder !== "undefined") {
      var bytes = new Uint8Array(bin.length);
      var i;
      for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(escape(bin));
  }

  function parseStbArabBootFromDom() {
    var el = document.getElementById("stbarab-boot");
    if (!el) return null;
    var text = el.textContent;
    if (!text || !String(text).trim()) return null;
    var raw = String(text).trim();
    try {
      if (el.getAttribute("data-enc") === "b64") {
        raw = decodeBootB64(raw);
      }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function hydrateFullFromBoot(boot) {
    if (!boot || !Array.isArray(boot.brainrots)) return false;
    var data = boot.brainrots;
    var types = boot.type_mults;
    var rebirth = boot.rebirths;
    var gadgets = boot.gadgets;
    var lucky = boot.luckyrots;
    var traits = boot.traits;
    var llamarots = boot.llamarots;
    var iconSheets = boot.brainrot_icon_sheets;
    var brainrotTypesCat = boot.brainrot_types;
    var catalogMeta = boot.catalog_meta;
    var rarityEngine = boot.rarity_spawn_engine;
    var typeSpawn = boot.type_spawn_rates;
    var typeSpawnEvents = boot.type_spawn_event_tables;

    CODES_PAYLOAD = normalizeCodesPayload(boot.codes);
    codesDataReady = true;
    checkForNewCodesAndNotify();
    if (boot.boxrots && typeof boot.boxrots === "object") {
      BOX_ROTS_PAYLOAD = normalizeBoxRotsPayload(boot.boxrots);
      boxRotsDataReady = true;
    } else {
      BOX_ROTS_PAYLOAD = null;
      boxRotsDataReady = false;
    }
    if (boot.wheel && typeof boot.wheel === "object") {
      WHEEL_PAYLOAD = normalizeWheelPayload(boot.wheel);
      wheelDataReady = true;
    } else {
      WHEEL_PAYLOAD = null;
      wheelDataReady = false;
    }
    MAP_PAGE_PAYLOAD = normalizeMapPayload(boot.map || {});
    SITE_ALERTS_PAYLOAD = normalizeSiteAlertsPayload(boot.site_alerts);
    renderSiteAlerts();

    TYPE_MULTS_PAYLOAD = normalizeTypeMultsPayload(types && types.types ? types : null);
    BRAINROT_TYPES_CATALOG = applyTypeMultsToBrainrotTypesCatalog(
      normalizeBrainrotTypesCatalogPayload(
        brainrotTypesCat && typeof brainrotTypesCat === "object" ? brainrotTypesCat : null,
      ),
    );
    BRAINROTS = data;
    assignCanonicalBrainrotSlugsToClientCatalog(BRAINROTS);
    applyBrainrotTypeCatalogMerge();
    BRAINROT_ICON_SHEETS = iconSheets && typeof iconSheets === "object" ? iconSheets : null;
    REBIRTHS_PAYLOAD = normalizeRebirthsPayload(rebirth);
    GADGETS_PAYLOAD = normalizeGadgetsPayload(gadgets);
    LUCKY_ROTS_PAYLOAD =
      lucky && Array.isArray(lucky.sections) ? lucky : { meta: {}, sections: [] };
    TRAITS_PAYLOAD = normalizeTraitsPayload(traits);
    LLAMA_ROTS_PAYLOAD = normalizeLlamaPayload(llamarots);
    RARITY_SPAWN_ENGINE_PAYLOAD = rarityEngine && typeof rarityEngine === "object" ? rarityEngine : null;
    BRAINROT_SPAWN_TYPE_PAYLOAD = typeSpawn && typeof typeSpawn === "object" ? typeSpawn : null;
    TYPE_SPAWN_EVENT_TABLES =
      typeSpawnEvents && typeof typeSpawnEvents === "object" && !Array.isArray(typeSpawnEvents)
        ? typeSpawnEvents
        : null;
    CATALOG_META =
      catalogMeta && typeof catalogMeta === "object" && !Array.isArray(catalogMeta)
        ? catalogMeta
        : null;

    if (
      boot.eternal_machine_rates &&
      typeof boot.eternal_machine_rates === "object" &&
      Array.isArray(boot.eternal_machine_rates.tiers) &&
      boot.eternal_machine_rates.tiers.length &&
      Array.isArray(boot.eternal_machine_rates.columns)
    ) {
      ETERNAL_MACHINE_RATES = boot.eternal_machine_rates;
    }
    if (boot.eternal_machine_reference && typeof boot.eternal_machine_reference === "object") {
      ETERNAL_MACHINE_REFERENCE = boot.eternal_machine_reference;
      eternalMachineSyncReferenceTypeRates();
    }

    if (boot.admin_machine_reference && typeof boot.admin_machine_reference === "object") {
      ADMIN_MACHINE_REF = boot.admin_machine_reference;
    }
    if (boot.admin_machine_icons && typeof boot.admin_machine_icons === "object") {
      ADMIN_MACHINE_ICONS_PAYLOAD = boot.admin_machine_icons;
    }

    if (boot.brainrot_ratings && boot.brainrot_ratings.ok) {
      applyBrainrotRatingsPayload(boot.brainrot_ratings);
      brainrotRatingsFromBoot = true;
    }
    if (boot.admin_machine_live) applyAdminMachineLiveFromBoot(boot.admin_machine_live);
    if (boot.realtime_events_schedule && typeof boot.realtime_events_schedule === "object") {
      REALTIME_EVENTS_SCHEDULE = boot.realtime_events_schedule;
    }

    rebirthGadgetsReady = true;
    luckyDataReady = true;
    traitsDataReady = true;
    llamaDataReady = true;
    catalogReady = true;
    applyBrainrotsPageLastUpdated();
    return true;
  }

  function hydrateSharedOnlyFromBoot(boot) {
    if (!boot || typeof boot !== "object") return;
    CODES_PAYLOAD = normalizeCodesPayload(boot.codes);
    codesDataReady = true;
    checkForNewCodesAndNotify();
    MAP_PAGE_PAYLOAD = normalizeMapPayload(boot.map || {});
    SITE_ALERTS_PAYLOAD = normalizeSiteAlertsPayload(boot.site_alerts);
    renderSiteAlerts();
    if (boot.admin_machine_reference && typeof boot.admin_machine_reference === "object") {
      ADMIN_MACHINE_REF = boot.admin_machine_reference;
    }
    if (boot.admin_machine_icons && typeof boot.admin_machine_icons === "object") {
      ADMIN_MACHINE_ICONS_PAYLOAD = boot.admin_machine_icons;
    }
    if (boot.brainrot_ratings && boot.brainrot_ratings.ok) {
      applyBrainrotRatingsPayload(boot.brainrot_ratings);
      brainrotRatingsFromBoot = true;
    }
    if (boot.admin_machine_live) applyAdminMachineLiveFromBoot(boot.admin_machine_live);
    if (boot.realtime_events_schedule && typeof boot.realtime_events_schedule === "object") {
      REALTIME_EVENTS_SCHEDULE = boot.realtime_events_schedule;
    }
  }

  function routeNeedsLazyFullCatalog(route) {
    var v = route.view;
    return (
      v === "brainrots" ||
      v === "detail" ||
      v === "income" ||
      v === "type-mults" ||
      v === "spawn-rates" ||
      v === "eternal-machine" ||
      v === "collection" ||
      v === "stats" ||
      v === "rebirth" ||
      v === "luckyrots" ||
      v === "traits" ||
      v === "llamarots"
    );
  }

  function fetchFullCatalogFromNetwork() {
    var load = $("#brainrot-load");
    if (load) {
      load.hidden = false;
      load.classList.remove("is-error");
      load.textContent = translationTx("brainrotsPage.loadingCatalog", "Loading catalog…");
    }
    var rebirthPromise = fetch(dataJsonUrl("data/rebirths.json"))
      .then(function (r) {
        return r.ok ? r.json() : { meta: {}, levels: [] };
      })
      .catch(function () {
        return { meta: {}, levels: [] };
      });
    var gadgetsPromise = fetch(dataJsonUrl("data/gadgets.json"))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    var luckyrotsPromise = fetch(dataJsonUrl("data/luckyrots.json"))
      .then(function (r) {
        return r.ok ? r.json() : { meta: {}, sections: [] };
      })
      .catch(function () {
        return { meta: {}, sections: [] };
      });
    var traitsPromise = fetchTraitsPayload();
    var llamarotsPromise = fetch(dataJsonUrl("data/llamarots.json"))
      .then(function (r) {
        return r.ok ? r.json() : { meta: {}, sections: [] };
      })
      .catch(function () {
        return { meta: {}, sections: [] };
      });
    Promise.all([rebirthPromise, gadgetsPromise])
      .then(function (pair) {
        var rebirth = pair[0];
        var gadgets = pair[1];
        REBIRTHS_PAYLOAD = normalizeRebirthsPayload(rebirth);
        GADGETS_PAYLOAD = normalizeGadgetsPayload(gadgets);
        rebirthGadgetsReady = true;
        renderRoute();
      })
      .catch(function () {
        REBIRTHS_PAYLOAD = { meta: {}, levels: [] };
        GADGETS_PAYLOAD = null;
        rebirthGadgetsReady = true;
        renderRoute();
      });
    luckyrotsPromise.then(function (lucky) {
      LUCKY_ROTS_PAYLOAD =
        lucky && Array.isArray(lucky.sections) ? lucky : { meta: {}, sections: [] };
      luckyDataReady = true;
      renderRoute();
    });
    traitsPromise.then(function (traits) {
      TRAITS_PAYLOAD = normalizeTraitsPayload(traits);
      traitsDataReady = true;
      renderRoute();
    });
    llamarotsPromise.then(function (llamarots) {
      LLAMA_ROTS_PAYLOAD = normalizeLlamaPayload(llamarots);
      llamaDataReady = true;
      renderRoute();
    });
    return Promise.all([
      fetch(dataJsonUrl("data/brainrots.json")).then(function (r) {
        if (!r.ok) throw new Error("Could not load data (" + r.status + ")");
        return r.json();
      }),
      fetch(dataJsonUrl("data/type_mults.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      rebirthPromise,
      gadgetsPromise,
      luckyrotsPromise,
      traitsPromise,
      llamarotsPromise,
      fetch(dataJsonUrl("data/brainrot_icon_sheets.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/brainrot_types.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/catalog_meta.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/type_spawn_rates.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/type_spawn_event_tables.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/rarity_spawn_engine.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/eternal_machine_rates.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
      fetch(dataJsonUrl("data/eternal_machine_reference.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        }),
    ])
      .then(function (results) {
        var data = results[0];
        var types = results[1];
        var rebirth = results[2];
        var gadgets = results[3];
        var lucky = results[4];
        var traits = results[5];
        var llamarots = results[6];
        var iconSheets = results[7];
        var brainrotTypesCat = results[8];
        var catalogMeta = results[9];
        var typeSpawn = results[10];
        var typeSpawnEvents = results[11];
        var rarityEngine = results[12];
        var eternalMachine = results[13];
        var eternalMachineRef = results[14];
        if (!Array.isArray(data)) throw new Error("Invalid data shape");
        TYPE_MULTS_PAYLOAD = normalizeTypeMultsPayload(types && types.types ? types : null);
        BRAINROT_TYPES_CATALOG = applyTypeMultsToBrainrotTypesCatalog(
          normalizeBrainrotTypesCatalogPayload(
            brainrotTypesCat && typeof brainrotTypesCat === "object" ? brainrotTypesCat : null,
          ),
        );
        BRAINROTS = data;
        assignCanonicalBrainrotSlugsToClientCatalog(BRAINROTS);
        applyBrainrotTypeCatalogMerge();
        BRAINROT_ICON_SHEETS = iconSheets && typeof iconSheets === "object" ? iconSheets : null;
        REBIRTHS_PAYLOAD = normalizeRebirthsPayload(rebirth);
        GADGETS_PAYLOAD = normalizeGadgetsPayload(gadgets);
        LUCKY_ROTS_PAYLOAD =
          lucky && Array.isArray(lucky.sections) ? lucky : { meta: {}, sections: [] };
        TRAITS_PAYLOAD = normalizeTraitsPayload(traits);
        LLAMA_ROTS_PAYLOAD = normalizeLlamaPayload(llamarots);
        RARITY_SPAWN_ENGINE_PAYLOAD = rarityEngine && typeof rarityEngine === "object" ? rarityEngine : null;
        ETERNAL_MACHINE_RATES =
          eternalMachine &&
          typeof eternalMachine === "object" &&
          Array.isArray(eternalMachine.tiers) &&
          Array.isArray(eternalMachine.columns)
            ? eternalMachine
            : null;
        ETERNAL_MACHINE_REFERENCE =
          eternalMachineRef && typeof eternalMachineRef === "object" ? eternalMachineRef : null;
        BRAINROT_SPAWN_TYPE_PAYLOAD = typeSpawn && typeof typeSpawn === "object" ? typeSpawn : null;
        TYPE_SPAWN_EVENT_TABLES =
          typeSpawnEvents && typeof typeSpawnEvents === "object" && !Array.isArray(typeSpawnEvents)
            ? typeSpawnEvents
            : null;
        CATALOG_META =
          catalogMeta && typeof catalogMeta === "object" && !Array.isArray(catalogMeta)
            ? catalogMeta
            : null;
        rebirthGadgetsReady = true;
        luckyDataReady = true;
        traitsDataReady = true;
        llamaDataReady = true;
        catalogReady = true;
        applyBrainrotsPageLastUpdated();
        var loadOk = $("#brainrot-load");
        if (loadOk) loadOk.hidden = true;
        try {
          wireUi();
        } finally {
          renderRoute();
        }
        scheduleBrainrotRatingsFetch();
        if (USE_HASH && String(location.hash || "").replace(/^#/, "")) {
          requestAnimationFrame(function () {
            renderRoute();
          });
        }
      })
      .catch(function () {
        showLoadError(
          "Could not load data/brainrots.json. Run npm start (port 8174) or another local static server so JSON and routes work."
        );
        Promise.all([rebirthPromise, gadgetsPromise, luckyrotsPromise, traitsPromise, llamarotsPromise])
          .then(function (bundle) {
            REBIRTHS_PAYLOAD = normalizeRebirthsPayload(bundle[0]);
            GADGETS_PAYLOAD = normalizeGadgetsPayload(bundle[1]);
            LUCKY_ROTS_PAYLOAD =
              bundle[2] && Array.isArray(bundle[2].sections)
                ? bundle[2]
                : { meta: {}, sections: [] };
            TRAITS_PAYLOAD = normalizeTraitsPayload(bundle[3]);
            LLAMA_ROTS_PAYLOAD = normalizeLlamaPayload(bundle[4]);
            rebirthGadgetsReady = true;
            luckyDataReady = true;
            traitsDataReady = true;
            llamaDataReady = true;
            catalogReady = true;
            try {
              wireUi();
            } finally {
              renderRoute();
              scheduleBrainrotRatingsFetch();
              if (USE_HASH && String(location.hash || "").replace(/^#/, "")) {
                requestAnimationFrame(renderRoute);
              }
            }
          })
          .catch(function () {
            rebirthGadgetsReady = true;
            luckyDataReady = true;
            traitsDataReady = true;
            llamaDataReady = true;
            catalogReady = true;
            try {
              wireUi();
            } finally {
              renderRoute();
              scheduleBrainrotRatingsFetch();
              if (USE_HASH && String(location.hash || "").replace(/^#/, "")) {
                requestAnimationFrame(renderRoute);
              }
            }
          });
      });
  }

  function maybeStartLazyDataLoads() {
    var route = parseRoute(getPath());
    if (route.view === "boxrots" && !boxRotsDataReady && !lazyBoxrotsPromise) {
      lazyBoxrotsPromise = fetch(dataJsonUrl("data/boxrots.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          BOX_ROTS_PAYLOAD = normalizeBoxRotsPayload(j);
          boxRotsDataReady = true;
          lazyBoxrotsPromise = null;
          renderRoute();
        });
      return;
    }
    if (route.view === "wheel" && !wheelDataReady && !lazyWheelPromise) {
      lazyWheelPromise = fetch(dataJsonUrl("data/wheel.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          WHEEL_PAYLOAD = normalizeWheelPayload(j);
          wheelDataReady = true;
          lazyWheelPromise = null;
          renderRoute();
        });
      return;
    }
    if (route.view === "shop" && !shopDataReady && !lazyShopPromise) {
      lazyShopPromise = fetch(dataJsonUrl("data/shop.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          SHOP_PAYLOAD = normalizeShopPayload(j);
          if (!SHOP_PAYLOAD.categories.length) {
            SHOP_PAYLOAD = normalizeShopPayload(SHOP_LAYOUT_FALLBACK);
          }
          shopDataReady = true;
          lazyShopPromise = null;
          renderRoute();
        });
      return;
    }
    if (!lazyCatalogBoot) return;
    if (routeNeedsLazyFullCatalog(route) && !catalogReady && !lazyFullCatalogPromise) {
      lazyFullCatalogPromise = fetchFullCatalogFromNetwork().finally(function () {
        lazyFullCatalogPromise = null;
      });
    }
  }

  function scheduleBrainrotRatingsFetch() {
    var apiRat = siteApiUrl("api/brainrot-ratings");
    if (!apiRat) return;
    if (brainrotRatingsFetchPromise) return;
    brainrotRatingsFetchPromise = fetch(apiRat, { credentials: "include" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      })
      .then(function (payload) {
        applyBrainrotRatingsPayload(payload);
        var pathR = getPath();
        var routeR = parseRoute(pathR);
        if (routeR.view === "brainrots") {
          renderBrainrots(getFilteredBrainrots());
        } else if (routeR.view === "spawn-rates") {
          spawnRatesApi.renderSpawnRatesPage();
        } else if (routeR.view === "detail") {
          renderRoute();
        }
      })
      .finally(function () {
        brainrotRatingsFetchPromise = null;
      });
  }

  function init() {
    $all("[data-spa-path]").forEach(function (el) {
      el.setAttribute("href", spaHref(el.getAttribute("data-spa-path")));
    });
    enhanceNavIcons();
    renderHomeQuickGrid();
    attachSpaListeners();
    loadTranslationsManifest()
      .then(function () {
        renderHeaderLangMenu();
        updateHeaderLangSelectedState(getStoredLang());
        wireLanguageSwitcher();
        return loadSiteI18nBundle(getStoredLang());
      })
      .then(function () {
        applySiteI18n(document.body);
        applyDocumentLangDirection(getStoredLang());
        try {
          renderRoute();
        } catch (err) {}
      })
      .catch(function () {});
    applyHeaderApiLinks();
    wireHeaderUserDropdown();
    wireSiteBrandMega();
    wireMainNavMobileDropdowns();
    ensureCodesPageHandlers();
    refreshHeaderAuth();
    stripAuthQueryFromUrl();
    pingSiteUserPresence();

    var bootDom = parseStbArabBootFromDom();
    lazyCatalogBoot = !!(bootDom && bootDom.stb_lazy_catalog === true);
    var catalogFromBoot = false;
    if (lazyCatalogBoot) {
      hydrateSharedOnlyFromBoot(bootDom);
    } else {
      catalogFromBoot = hydrateFullFromBoot(bootDom);
    }

    if (!catalogFromBoot && !lazyCatalogBoot) {
      fetch(dataJsonUrl("data/codes.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          CODES_PAYLOAD = normalizeCodesPayload(j);
          codesDataReady = true;
          checkForNewCodesAndNotify();
          renderRoute();
        });

      fetch(dataJsonUrl("data/map.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          MAP_PAGE_PAYLOAD = normalizeMapPayload(j || {});
          renderRoute();
        });

      fetch(dataJsonUrl("data/site_alerts.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          SITE_ALERTS_PAYLOAD = normalizeSiteAlertsPayload(j);
          renderSiteAlerts();
        });
    }

    if (!lazyCatalogBoot && !boxRotsDataReady) {
      fetch(dataJsonUrl("data/boxrots.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          BOX_ROTS_PAYLOAD = normalizeBoxRotsPayload(j);
          boxRotsDataReady = true;
          renderRoute();
        });
    }

    if (!lazyCatalogBoot && !wheelDataReady) {
      fetch(dataJsonUrl("data/wheel.json"))
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        })
        .then(function (j) {
          WHEEL_PAYLOAD = normalizeWheelPayload(j);
          wheelDataReady = true;
          renderRoute();
        });
    }

    refreshTraitsFromServer().then(function () {
      try {
        renderRoute();
      } catch (errTraits) {}
    });

    if (catalogFromBoot) {
      var loadBoot = $("#brainrot-load");
      if (loadBoot) loadBoot.hidden = true;
      try {
        wireUi();
      } finally {
        renderRoute();
      }
      if (brainrotRowsMissingCarpetChance(BRAINROTS)) {
        fetch(dataJsonUrl("data/brainrots.json"))
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          })
          .then(function (data) {
            if (!Array.isArray(data)) return;
            BRAINROTS = data;
            assignCanonicalBrainrotSlugsToClientCatalog(BRAINROTS);
            applyBrainrotTypeCatalogMerge();
            applyBrainrotsPageLastUpdated();
            try {
              wireUi();
            } finally {
              renderRoute();
            }
          });
      }
    } else if (!lazyCatalogBoot) {
      renderRoute();
      scheduleBrainrotRatingsFetch();
    }
    loadAdminMachineData().then(function () {
      renderRoute();
    });

    if (catalogFromBoot) {
      scheduleBrainrotRatingsFetch();
      if (USE_HASH && String(location.hash || "").replace(/^#/, "")) {
        requestAnimationFrame(function () {
          renderRoute();
        });
      }
      return;
    }

    if (lazyCatalogBoot) {
      return;
    }

    fetchFullCatalogFromNetwork();
  }

  function siteUserKeyEnsure() {
    var key = "";
    try {
      key = String(localStorage.getItem("stbarab_site_user_key") || "").trim();
    } catch (e) {}
    if (!/^[a-z0-9._:-]{8,64}$/i.test(key)) {
      var rand = "";
      try {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          rand = window.crypto.randomUUID().replace(/[^a-z0-9-]/gi, "").toLowerCase();
        }
      } catch (e2) {}
      if (!rand) {
        rand =
          String(Date.now().toString(36)) +
          "-" +
          Math.random().toString(36).slice(2, 14) +
          Math.random().toString(36).slice(2, 8);
      }
      key = "site-" + rand.slice(0, 56);
      try {
        localStorage.setItem("stbarab_site_user_key", key);
      } catch (e3) {}
    }
    return key;
  }

  function pingSiteUserPresence() {
    var key = siteUserKeyEnsure();
    if (!key) return;
    fetch("/api/site-users/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        userKey: key,
        path: location.pathname + location.search + location.hash,
      }),
    }).catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
