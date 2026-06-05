(function () {
  "use strict";

  var STORAGE_KEY = "stbarab_collection_v1";
  var saveTimer = null;

  function apiFetchPath(rel) {
    var clean = String(rel || "").replace(/^\/+/, "");
    if (typeof window.STBARAB_SITE_API === "function") {
      var u = window.STBARAB_SITE_API(clean);
      if (u) return u;
    }
    return "/" + clean;
  }

  function copyTextToClipboard(text, done) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          done(true);
        })
        .catch(function () {
          done(copyTextToClipboardExec(text));
        });
      return;
    }
    done(copyTextToClipboardExec(text));
  }

  function copyTextToClipboardExec(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function discordLoginHref() {
    var p = typeof window.STBARAB_APP_PATH_PREFIX === "string" ? window.STBARAB_APP_PATH_PREFIX : "";
    p = p.replace(/\/$/, "");
    return (p || "") + "/api/auth/discord";
  }

  var DISCORD_LOGO_PATH =
    "M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z";

  function svgDiscordMark(className, w, h) {
    return (
      '<svg class="' +
      className +
      '" xmlns="http://www.w3.org/2000/svg" viewBox="0 -28.5 256 256" width="' +
      w +
      '" height="' +
      h +
      '" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" fill-rule="nonzero" d="' +
      DISCORD_LOGO_PATH +
      '"/></svg>'
    );
  }

  function renderCollectionLoginGate(root) {
    var href = escapeHtml(discordLoginHref());
    root.innerHTML =
      '<div class="collection-inner collection-inner--gate">' +
      '<div class="collection-login-gate">' +
      '<div class="collection-login-gate__icon-wrap">' +
      svgDiscordMark("collection-login-gate__mark", 88, 88) +
      "</div>" +
      '<h1 class="collection-login-gate__title">' +
      escapeHtml(tx("collectionPage.gateTitle", "Sign in to track your brainrots")) +
      "</h1>" +
      '<p class="collection-login-gate__lede">' +
      escapeHtml(tx("collectionPage.gateLede", "Connect Discord to save your collection, sync progress, and share a link with others.")) +
      "</p>" +
      '<a class="collection-login-gate__btn" href="' +
      href +
      '">' +
      svgDiscordMark("collection-login-gate__btn-icon", 24, 24) +
      "<span>" +
      escapeHtml(tx("collectionPage.gateBtn", "Continue with Discord")) +
      "</span></a>" +
      '<p class="collection-login-gate__hint">' +
      escapeHtml(tx("collectionPage.gateHint", "You need to log in before you can mark brainrots and variants in the grid.")) +
      "</p>" +
      "</div></div>";
    if (typeof document !== "undefined" && window.STBARAB_BASE_TITLE) {
      document.title =
        tx("collectionPage.docTitle", "Collection Tracker") + " · " + window.STBARAB_BASE_TITLE;
    }
  }

  function defaultState() {
    return { v: 1, claimed: [], typesDone: [], hideFromOthers: false, notifyNewCodes: false };
  }

  function arrToSet(a) {
    var o = {};
    (a || []).forEach(function (x) {
      o[String(x)] = true;
    });
    return o;
  }

  function setToArr(o) {
    return Object.keys(o || {}).sort();
  }

  function normalizeState(s) {
    var d = defaultState();
    if (!s || typeof s !== "object") return d;
    d.claimed = Array.isArray(s.claimed) ? s.claimed.map(String) : [];
    d.typesDone = Array.isArray(s.typesDone) ? s.typesDone.map(String) : [];
    d.hideFromOthers = s.hideFromOthers === true;
    d.notifyNewCodes = s.notifyNewCodes === true;
    return d;
  }

  function mergeState(base, incoming) {
    var claimed = arrToSet(base.claimed);
    (incoming.claimed || []).forEach(function (x) {
      claimed[String(x)] = true;
    });
    var typesDone = arrToSet(base.typesDone);
    (incoming.typesDone || []).forEach(function (x) {
      typesDone[String(x)] = true;
    });
    return {
      v: 1,
      claimed: setToArr(claimed),
      typesDone: setToArr(typesDone),
      hideFromOthers: base.hideFromOthers === true,
      notifyNewCodes: base.notifyNewCodes === true,
    };
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function tx(key, fb) {
    if (typeof window.STBARAB_TRANSLATION_TX === "function") {
      return window.STBARAB_TRANSLATION_TX(key, fb);
    }
    return fb;
  }

  /** Safe `id="..."` fragment for header controls (must be unique per table). */
  function idFragment(s) {
    return String(s == null ? "" : s)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x";
  }

  function brainrotIconUrl(b) {
    if (b.icon) return b.icon;
    return "/assets/images/brainrots/types/default/" + encodeURIComponent(b.slug) + ".png";
  }

  function assetUrl(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    var prefix = "";
    try {
      var baseEl = document.querySelector("base");
      if (baseEl && baseEl.href) {
        var p = new URL(baseEl.href, location.href).pathname.replace(/\/$/, "");
        if (p && p !== "/") prefix = p;
      }
    } catch (e) {}
    if (u.indexOf("/") === 0) return prefix + u;
    return prefix + "/" + u;
  }

  /** Default-type art only — variant columns stay checkbox-only. */
  function nameColumnThumbInner(b) {
    if (typeof window.STBARAB_BRAINROT_THUMB_MEDIA_HTML === "function") {
      return window.STBARAB_BRAINROT_THUMB_MEDIA_HTML(b.name, b, "default", {
        imgClass: "brainrot-thumb__img brainrot-thumb__sprite brainrot-thumb__atlas collection-matrix__name-img",
        fallbackClass: "collection-matrix__name-glyph",
      });
    }
    return (
      '<img class="collection-matrix__name-fallback-img" src="' +
      escapeHtml(assetUrl(brainrotIconUrl(b))) +
      '" alt="" loading="lazy" decoding="async" />'
    );
  }

  function rarityClass(r) {
    var m = {
      Common: "rarity-common",
      Rare: "rarity-rare",
      Epic: "rarity-epic",
      Legendary: "rarity-legendary",
      Mythic: "rarity-mythic",
      "Brainrot God": "rarity-brainrot-god",
      BrainrotGod: "rarity-brainrot-god",
      Secret: "rarity-secret",
      Eternal: "rarity-eternal",
      Admin: "rarity-admin",
      Goat: "rarity-goat",
      LuckyRot: "rarity-luckyrot",
    };
    return m[r] || "rarity-common";
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

  /** Rarity blocks + toolbar: LuckyRot / Admin are excluded from the grid (still kept in saved state). */
  var COLLECTION_RARITY_ORDER = RARITY_ORDER.filter(function (r) {
    return r !== "LuckyRot" && r !== "Admin";
  });

  function collectionRarityExcludedFromGrid(r) {
    return r === "LuckyRot" || r === "Admin";
  }

  function brainrotsInCollectionTracker(brainrotsAll) {
    return (brainrotsAll || []).filter(function (b) {
      return !collectionRarityExcludedFromGrid(normalizeRarityForRow(b));
    });
  }

  /**
   * Merge prior claimed keys for LuckyRot/Admin rows (not rendered) so edits elsewhere do not wipe them.
   */
  function preserveExcludedRarityClaims(fromDomList, prevClaimed, brainrotsAll) {
    var set = arrToSet(fromDomList);
    (prevClaimed || []).forEach(function (k) {
      k = String(k);
      var slug = k.split(":")[0];
      var b = null;
      var i;
      for (i = 0; i < (brainrotsAll || []).length; i++) {
        if (brainrotsAll[i] && brainrotsAll[i].slug === slug) {
          b = brainrotsAll[i];
          break;
        }
      }
      if (!b) {
        set[k] = true;
        return;
      }
      if (collectionRarityExcludedFromGrid(normalizeRarityForRow(b))) set[k] = true;
    });
    return setToArr(set);
  }

  function formatRarityLabel(rarity) {
    if (rarity === "BrainrotGod") return "Brainrot God";
    if (rarity === "LuckyRot") return "Lucky Rots";
    return String(rarity == null ? "" : rarity);
  }

  /**
   * Lowercase blob for the filter box: name, slug, game rarity, and mutation names/slugs this row has.
   */
  function rowSearchHaystack(b, rarityLabel, catTypes) {
    var parts = [];
    if (b && b.name) parts.push(String(b.name).toLowerCase());
    if (b && b.slug) parts.push(String(b.slug).toLowerCase().replace(/-/g, " "));
    parts.push(formatRarityLabel(rarityLabel).toLowerCase());
    parts.push(String(rarityLabel).toLowerCase());
    if (rarityLabel === "Brainrot God") parts.push("brainrotgod");
    if (rarityLabel === "LuckyRot") parts.push("luckyrots", "lucky rots", "luckyrot", "lucky");
    (catTypes || []).forEach(function (ty) {
      if (!ty || !brainrotHasType(b, ty.slug)) return;
      var slug = String(ty.slug || "").toLowerCase().replace(/-/g, " ");
      if (slug) parts.push(slug);
      var nm = String(ty.name || ty.slug || "").toLowerCase();
      if (nm) {
        parts.push(nm);
        if (nm.indexOf(" & ") >= 0) {
          nm.split(/\s*&\s*/).forEach(function (bit) {
            bit = bit.trim();
            if (bit) parts.push(bit);
          });
        }
      }
    });
    return parts.join(" ");
  }

  function claimedFingerprint(claimed) {
    return JSON.stringify(
      (claimed || [])
        .slice()
        .sort()
    );
  }

  /** Legacy saves used bare `slug`; matrix uses `slug:typeSlug`. */
  function expandLegacyClaimedArray(claimed, brainrots) {
    var bySlug = {};
    brainrots.forEach(function (b) {
      if (b && b.slug) bySlug[b.slug] = b;
    });
    var out = {};
    (claimed || []).forEach(function (k) {
      k = String(k);
      if (k.indexOf(":") >= 0) {
        out[k] = true;
        return;
      }
      var b = bySlug[k];
      if (b && b.types && b.types.length) {
        b.types.forEach(function (t) {
          if (t && t.slug) out[k + ":" + t.slug] = true;
        });
      } else {
        out[k + ":default"] = true;
      }
    });
    return setToArr(out);
  }

  function migrateStateForUI(state, brainrots) {
    var s = normalizeState(state);
    s.claimed = expandLegacyClaimedArray(s.claimed, brainrots);
    return s;
  }

  function brainrotHasType(b, typeSlug) {
    return (b.types || []).some(function (t) {
      return t && t.slug === typeSlug;
    });
  }

  function normalizeRarityForRow(b) {
    if (!b) return "Common";
    var r = b.rarity;
    if (r === "BrainrotGod") return "Brainrot God";
    if (r == null || String(r).trim() === "") return "Common";
    var s = String(r).trim();
    if (s.toLowerCase() === "luckyrots") return "LuckyRot";
    var k;
    for (k = 0; k < RARITY_ORDER.length; k++) {
      if (RARITY_ORDER[k].toLowerCase() === s.toLowerCase()) return RARITY_ORDER[k];
    }
    return s;
  }

  /** Default income / sec for list order (worst → best, same as in-game brainrot list). */
  function brainrotBaseIncome(b) {
    if (!b) return 0;
    var n = b.incomePerSec;
    if (typeof n === "number" && n === n) return n;
    if (n != null && n !== "") {
      var p = parseFloat(String(n));
      if (p === p) return p;
    }
    return 0;
  }

  function brainrotsGroupedByRarity(brainrots) {
    var buckets = {};
    COLLECTION_RARITY_ORDER.forEach(function (r) {
      buckets[r] = [];
    });
    brainrots.forEach(function (b) {
      var r = normalizeRarityForRow(b);
      if (!buckets[r]) buckets[r] = [];
      buckets[r].push(b);
    });
    COLLECTION_RARITY_ORDER.forEach(function (r) {
      if (!buckets[r]) buckets[r] = [];
      buckets[r].sort(function (a, b) {
        var ia = brainrotBaseIncome(a);
        var ib = brainrotBaseIncome(b);
        if (ia !== ib) return ia - ib;
        var aid = typeof a.id === "number" && a.id === a.id ? a.id : 1e9;
        var bid = typeof b.id === "number" && b.id === b.id ? b.id : 1e9;
        if (aid !== bid) return aid - bid;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    });
    return buckets;
  }

  function countMatrixCells(brainrots) {
    var n = 0;
    brainrots.forEach(function (b) {
      var rows = b.types && b.types.length ? b.types : [{ slug: "default" }];
      n += rows.length;
    });
    return n;
  }

  function countClaimedMatrix(claimedSet, brainrots) {
    var n = 0;
    brainrots.forEach(function (b) {
      var rows = b.types && b.types.length ? b.types : [{ slug: "default" }];
      rows.forEach(function (t) {
        var ts = t.slug || "default";
        if (claimedSet[b.slug + ":" + ts]) n++;
      });
    });
    return n;
  }

  function variantTotalsByMutation(claimedSet, brainrotsList, catTypesList) {
    var out = [];
    (catTypesList || []).forEach(function (ct) {
      if (!ct || !ct.slug) return;
      var slug = String(ct.slug);
      var total = 0;
      var got = 0;
      (brainrotsList || []).forEach(function (b) {
        if (!brainrotHasType(b, slug)) return;
        total++;
        if (claimedSet[b.slug + ":" + slug]) got++;
      });
      out.push({
        slug: slug,
        label: String(ct.name != null && String(ct.name).trim() !== "" ? ct.name : slug),
        got: got,
        total: total,
      });
    });
    return out;
  }

  function variantChipHtml(row) {
    var fill = row.total > 0 ? row.got / row.total : 0;
    var complete = row.total > 0 && row.got >= row.total;
    var cls = "collection-variant-chip" + (complete ? " collection-variant-chip--complete" : "");
    return (
      '<span class="' +
      cls +
      '" data-mutation="' +
      escapeHtml(row.slug) +
      '" style="--fill:' +
      fill +
      '" title="' +
      escapeAttr(row.label + " — " + row.got + " / " + row.total) +
      '"><span class="collection-variant-chip__body"><span class="collection-variant-chip__label">' +
      escapeHtml(row.label) +
      '</span><span class="collection-variant-chip__ratio"><span class="collection-variant-chip__got">' +
      escapeHtml(String(row.got)) +
      '</span><span class="collection-variant-chip__sep">/</span><span class="collection-variant-chip__total">' +
      escapeHtml(String(row.total)) +
      '</span></span></span><span class="collection-variant-chip__track"><span class="collection-variant-chip__fill"></span></span></span>'
    );
  }

  /**
   * @param {string} [variantSlug] Toolbar "Show variant" — when set, only that mutation column counts.
   */
  function rarityTableProgress(claimedSet, list, catTypes, variantSlug) {
    variantSlug = variantSlug ? String(variantSlug) : "";
    var total = 0;
    var got = 0;
    list.forEach(function (b) {
      if (variantSlug) {
        if (!brainrotHasType(b, variantSlug)) return;
        total++;
        if (claimedSet[b.slug + ":" + variantSlug]) got++;
        return;
      }
      catTypes.forEach(function (ct) {
        if (!brainrotHasType(b, ct.slug)) return;
        total++;
        if (claimedSet[b.slug + ":" + ct.slug]) got++;
      });
    });
    return { got: got, total: total };
  }

  function rarityAllClaimed(claimedSet, list, catTypes, variantSlug) {
    variantSlug = variantSlug ? String(variantSlug) : "";
    if (!list.length) return false;
    if (variantSlug) {
      var anyReq = false;
      var i;
      for (i = 0; i < list.length; i++) {
        var bi = list[i];
        if (!brainrotHasType(bi, variantSlug)) continue;
        anyReq = true;
        if (!claimedSet[bi.slug + ":" + variantSlug]) return false;
      }
      return anyReq;
    }
    var j;
    var k;
    var anyRequired = false;
    for (i = 0; i < list.length; i++) {
      var b = list[i];
      for (j = 0; j < catTypes.length; j++) {
        var ct = catTypes[j];
        if (!brainrotHasType(b, ct.slug)) continue;
        anyRequired = true;
        if (!claimedSet[b.slug + ":" + ct.slug]) return false;
      }
    }
    return anyRequired;
  }

  /**
   * Keys toggled by the rarity header checkbox. Scoped to one mutation when variantSlug is set.
   */
  function collectClaimKeysForRarity(list, catTypes, variantSlug) {
    variantSlug = variantSlug ? String(variantSlug) : "";
    var keys = {};
    if (variantSlug) {
      list.forEach(function (b) {
        if (brainrotHasType(b, variantSlug)) keys[b.slug + ":" + variantSlug] = true;
      });
      return keys;
    }
    list.forEach(function (b) {
      catTypes.forEach(function (ct) {
        if (brainrotHasType(b, ct.slug)) keys[b.slug + ":" + ct.slug] = true;
      });
    });
    return keys;
  }

  var collectionRarityConfirmWired = false;
  var collectionRarityConfirmOnOk = null;

  function collectionRarityConfirmVariantLabel(vSlug, catTypes) {
    if (!vSlug) return "";
    var i;
    for (i = 0; i < catTypes.length; i++) {
      if (catTypes[i].slug === vSlug) {
        return String(catTypes[i].name || catTypes[i].slug || vSlug);
      }
    }
    return vSlug;
  }

  function closeCollectionRarityConfirm() {
    var shell = document.getElementById("collection-rarity-confirm");
    if (shell) shell.hidden = true;
    collectionRarityConfirmOnOk = null;
    if (document.body) document.body.classList.remove("collection-rarity-confirm-open");
  }

  function wireCollectionRarityConfirmOnce() {
    if (collectionRarityConfirmWired) return;
    var shell = document.getElementById("collection-rarity-confirm");
    if (!shell) return;
    collectionRarityConfirmWired = true;
    var back = shell.querySelector("[data-collection-rarity-confirm-backdrop]");
    var cancelBtn = shell.querySelector("[data-collection-rarity-confirm-cancel]");
    var okBtn = shell.querySelector("[data-collection-rarity-confirm-ok]");
    if (back) {
      back.addEventListener("click", function () {
        closeCollectionRarityConfirm();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        closeCollectionRarityConfirm();
      });
    }
    if (okBtn) {
      okBtn.addEventListener("click", function () {
        var fn = collectionRarityConfirmOnOk;
        closeCollectionRarityConfirm();
        if (fn) fn();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var open = document.getElementById("collection-rarity-confirm");
      if (!open || open.hidden) return;
      closeCollectionRarityConfirm();
    });
  }

  function ensureCollectionRarityConfirmShell() {
    var shell = document.getElementById("collection-rarity-confirm");
    if (shell) return shell;
    shell = document.createElement("div");
    shell.id = "collection-rarity-confirm";
    shell.className = "collection-rarity-confirm";
    shell.hidden = true;
    shell.innerHTML =
      '<div class="collection-rarity-confirm__backdrop" data-collection-rarity-confirm-backdrop" aria-hidden="true"></div>' +
      '<div class="collection-rarity-confirm__panel" role="alertdialog" aria-modal="true" aria-labelledby="collection-rarity-confirm-title" aria-describedby="collection-rarity-confirm-body">' +
      '<h2 class="collection-rarity-confirm__title" id="collection-rarity-confirm-title"></h2>' +
      '<p class="collection-rarity-confirm__body" id="collection-rarity-confirm-body"></p>' +
      '<div class="collection-rarity-confirm__actions">' +
      '<button type="button" class="btn-secondary collection-rarity-confirm__btn" data-collection-rarity-confirm-cancel></button>' +
      '<button type="button" class="btn-primary collection-rarity-confirm__btn" data-collection-rarity-confirm-ok></button>' +
      "</div></div>";
    document.body.appendChild(shell);
    wireCollectionRarityConfirmOnce();
    return shell;
  }

  function openCollectionRarityConfirm(opts) {
    opts = opts || {};
    var shell = ensureCollectionRarityConfirmShell();
    var titleEl = shell.querySelector("#collection-rarity-confirm-title");
    var bodyEl = shell.querySelector("#collection-rarity-confirm-body");
    var cancelBtn = shell.querySelector("[data-collection-rarity-confirm-cancel]");
    var okBtn = shell.querySelector("[data-collection-rarity-confirm-ok]");
    if (titleEl) titleEl.textContent = opts.title || "";
    if (bodyEl) bodyEl.textContent = opts.body || "";
    if (cancelBtn) {
      cancelBtn.textContent = tx("collectionPage.rarityConfirmCancel", "Cancel");
    }
    if (okBtn) {
      okBtn.textContent = opts.okLabel || tx("collectionPage.rarityConfirmOk", "Continue");
    }
    collectionRarityConfirmOnOk = typeof opts.onConfirm === "function" ? opts.onConfirm : null;
    shell.hidden = false;
    if (document.body) document.body.classList.add("collection-rarity-confirm-open");
    if (okBtn) okBtn.focus();
  }

  function persistLocal(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function scheduleCloudSave(state) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      fetch(apiFetchPath("api/collection"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimed: state.claimed,
          typesDone: state.typesDone,
          hideFromOthers: state.hideFromOthers === true,
          notifyNewCodes: state.notifyNewCodes === true,
        }),
      }).catch(function () {});
    }, 600);
  }

  function renderCollectionUI(root, state, opts) {
    opts = opts || {};
    var readOnly = !!opts.readOnly;
    var shareSnapshot = opts.shareSnapshot || null;
    var brainrotsAll = window.STBARAB_BRAINROTS || [];
    var brainrots = brainrotsInCollectionTracker(brainrotsAll);
    var cat = window.STBARAB_TYPES_CATALOG;
    var catTypes = (cat && Array.isArray(cat.types) ? cat.types : []).slice();
    if (!catTypes.length) {
      catTypes = [{ slug: "default", name: "Default" }];
    }

    var preserveSearch = "";
    var preserveRarity = "";
    var preserveVariant = "";
    var preserveMissingView = false;
    try {
      var prevSearchEl = root.querySelector("#collection-search");
      var prevRarityEl = root.querySelector("#collection-rarity");
      var prevVariantEl = root.querySelector("#collection-variant");
      var prevMissingViewBtn = root.querySelector("#collection-missing-view");
      if (prevSearchEl) preserveSearch = prevSearchEl.value;
      if (prevRarityEl) preserveRarity = prevRarityEl.value;
      if (prevVariantEl) preserveVariant = prevVariantEl.value;
      if (prevMissingViewBtn) {
        preserveMissingView = prevMissingViewBtn.getAttribute("aria-pressed") === "true";
      } else {
        try {
          preserveMissingView = localStorage.getItem("stbarab_collection_missing_view_v1") === "1";
        } catch (eMv) {}
      }
    } catch (e) {}

    var fpBefore = claimedFingerprint(state.claimed);
    state = migrateStateForUI(state, brainrotsAll);
    if (!readOnly && fpBefore !== claimedFingerprint(state.claimed)) {
      persistLocal(state);
      scheduleCloudSave(state);
    }

    var tdKeep = normalizeState(state).typesDone.slice();
    var claimedSet = arrToSet(state.claimed);
    var totalCells = countMatrixCells(brainrots);
    var claimedCount = countClaimedMatrix(claimedSet, brainrots);
    var missingCount = totalCells - claimedCount;
    if (missingCount < 0) missingCount = 0;
    var pct = totalCells ? Math.round((claimedCount / totalCells) * 1000) / 10 : 0;
    var buckets = brainrotsGroupedByRarity(brainrots);

    var ownerName = opts.ownerName != null ? String(opts.ownerName).trim() : "";
    var headline = tx("collectionPage.headlineTracker", "Collection Tracker");
    var intro = escapeHtml(tx("collectionPage.introOwn", "This page can help you keep track of your index collection!"));
    if (readOnly) {
      if (ownerName) {
        headline = tx("collectionPage.headlineUserCollection", "{name} Collection").replace(
          /\{name\}/g,
          ownerName,
        );
        intro = escapeHtml(
          tx(
            "collectionPage.introSharedNamed",
            "Shared snapshot of {name}'s claimed skins. Use Copy to my tracker below to merge into your device.",
          ).replace(/\{name\}/g, String(ownerName)),
        );
      } else {
        headline = tx("collectionPage.headlineShared", "Shared collection");
        intro = escapeHtml(
          tx(
            "collectionPage.introSharedAnonymous",
            "Read-only snapshot. Use Copy to my tracker to merge into your device.",
          ),
        );
      }
    }

    var hero =
      '<div class="collection-hero">' +
      "<h1>" +
      escapeHtml(headline) +
      "</h1>" +
      "<p>" +
      intro +
      "</p>" +
      '<div class="collection-stats">' +
      '<span class="collection-stat"><strong id="collection-stat-n">' +
      claimedCount +
      "</strong> / " +
      totalCells +
      " " +
      escapeHtml(tx("collectionPage.statCells", "cells")) +
      "</span>" +
      '<span class="collection-stat"><strong id="collection-stat-pct">' +
      pct +
      "%</strong> " +
      escapeHtml(tx("collectionPage.statComplete", "complete")) +
      "</span>" +
      '<span class="collection-stat collection-stat--missing"><strong id="collection-stat-missing">' +
      missingCount +
      "</strong> " +
      escapeHtml(tx("collectionPage.statMissing", "missing")) +
      "</span>" +
      (readOnly
        ? '<span class="collection-badge collection-badge--ro">' +
          escapeHtml(tx("collectionPage.badgeReadOnly", "Read-only share")) +
          "</span>"
        : "") +
      "</div>" +
      "</div>";

    var variantOptions =
      '<option value="">' +
      escapeHtml(tx("collectionPage.optAllVariants", "All variants")) +
      "</option>" +
      catTypes
        .map(function (ty) {
          return (
            '<option value="' +
            escapeHtml(ty.slug) +
            '">' +
            escapeHtml(ty.name || ty.slug) +
            "</option>"
          );
        })
        .join("");

    var toolbar =
      '<div class="collection-toolbar">' +
      '<div class="collection-toolbar__row collection-toolbar__row--search">' +
      '<label class="search-wrap collection-toolbar__search"><span class="sr-only">' +
      escapeHtml(tx("collectionPage.srSearch", "Search")) +
      "</span>" +
      '<input type="search" class="search-input" id="collection-search" placeholder="' +
      escapeAttr(tx("collectionPage.placeholderSearch", "Name, rarity, or variant (e.g. gold, crystal)…")) +
      '" autocomplete="off" /></label></div>' +
      '<div class="collection-toolbar__row collection-toolbar__row--filters">' +
      '<div class="collection-toolbar__filter-group">' +
      '<label class="collection-toolbar__filter-label" for="collection-rarity">' +
      escapeHtml(tx("collectionPage.labelShowRarity", "Show rarity")) +
      "</label>" +
      '<select class="select" id="collection-rarity">' +
      '<option value="">' +
      escapeHtml(tx("collectionPage.optAllRarities", "All rarities")) +
      "</option>" +
      COLLECTION_RARITY_ORDER.map(function (x) {
        return (
          '<option value="' +
          escapeHtml(x) +
          '">' +
          escapeHtml(formatRarityLabel(x)) +
          "</option>"
        );
      }).join("") +
      "</select></div>" +
      '<div class="collection-toolbar__filter-group">' +
      '<label class="collection-toolbar__filter-label" for="collection-variant">' +
      escapeHtml(tx("collectionPage.labelShowVariant", "Show variant")) +
      "</label>" +
      '<select class="select" id="collection-variant">' +
      variantOptions +
      "</select></div></div>" +
      '<div class="collection-toolbar__row collection-toolbar__row--actions">' +
      '<button type="button" class="btn-secondary collection-missing-view-btn' +
      (preserveMissingView ? " collection-missing-view-btn--active" : "") +
      '" id="collection-missing-view" aria-pressed="' +
      (preserveMissingView ? "true" : "false") +
      '"' +
      (preserveMissingView ? " hidden" : "") +
      ">" +
      escapeHtml(tx("collectionPage.btnMissingTables", "Show missing to index")) +
      "</button>" +
      (readOnly
        ? '<button type="button" class="btn collection-merge-btn" id="collection-copy-merge">' +
          escapeHtml(tx("collectionPage.btnCopyMerge", "Copy to my tracker")) +
          "</button>"
        : '<button type="button" class="btn-secondary collection-toolbar__share-btn" id="collection-share">' +
          escapeHtml(tx("collectionPage.btnCopyShare", "Copy share link")) +
          "</button>") +
      '<span class="collection-share-out" id="collection-share-out" hidden></span></div></div></div>';

    var variantTotalsRows = variantTotalsByMutation(claimedSet, brainrots, catTypes).filter(function (x) {
      return x.total > 0;
    });
    var variantTotalsCollapsed = false;
    try {
      variantTotalsCollapsed = localStorage.getItem("stbarab_collection_variant_totals_v1") === "1";
    } catch (eVtc) {}
    var variantTotalsHtml = "";
    if (variantTotalsRows.length) {
      variantTotalsHtml =
        '<div class="collection-variant-totals' +
        (variantTotalsCollapsed ? " collection-variant-totals--collapsed" : "") +
        (preserveMissingView ? " collection-variant-totals--view-hidden" : "") +
        '" role="region" aria-label="' +
        escapeAttr(
          tx(
            "collectionPage.variantTotalsAria",
            "Claimed cells per mutation versus how many exist in the tracker catalog.",
          ),
        ) +
        '">' +
        '<div class="collection-variant-totals__top">' +
        '<span class="collection-variant-totals__head" id="collection-variant-totals-heading">' +
        escapeHtml(tx("collectionPage.variantTotalsTitle", "Mutation totals")) +
        '</span><button type="button" class="collection-variant-totals__toggle" id="collection-variant-totals-toggle" aria-expanded="' +
        (variantTotalsCollapsed ? "false" : "true") +
        '" aria-controls="collection-variant-totals-panel" aria-label="' +
        escapeAttr(
          variantTotalsCollapsed
            ? tx("collectionPage.variantTotalsExpand", "Show mutation totals")
            : tx("collectionPage.variantTotalsCollapse", "Hide mutation totals"),
        ) +
        '"><span class="collection-variant-totals__chevron" aria-hidden="true"></span></button></div>' +
        '<div class="collection-variant-totals__panel" id="collection-variant-totals-panel"' +
        (variantTotalsCollapsed ? " hidden" : "") +
        '"><div class="collection-variant-totals__chips" id="collection-variant-totals-chips">' +
        variantTotalsRows
          .map(function (row) {
            return variantChipHtml(row);
          })
          .join("") +
        "</div></div></div";
    }

    var rarityBlocks = COLLECTION_RARITY_ORDER.map(function (rarityLabel) {
      var list = buckets[rarityLabel] || [];
      if (!list.length) return "";
      var prog = rarityTableProgress(claimedSet, list, catTypes, preserveVariant);
      var done = rarityAllClaimed(claimedSet, list, catTypes, preserveVariant);
      var rarityHeadId = "cr-head-" + idFragment(rarityLabel);
      var head =
        '<div class="collection-type-head">' +
        '<input type="checkbox" class="collection-rarity-done" id="' +
        rarityHeadId +
        '" data-rarity="' +
        escapeHtml(rarityLabel) +
        '" ' +
        (done ? "checked" : "") +
        (readOnly ? " disabled" : "") +
        ' title="' +
        escapeAttr(
          tx(
            "collectionPage.rarityHeadTitle",
            'With "Show variant" set to one column, marks only that column for this rarity. Otherwise marks every variant column.',
          ),
        ) +
        '" />' +
        '<label class="collection-type-head__text" for="' +
        rarityHeadId +
        '">' +
        escapeHtml(formatRarityLabel(rarityLabel)) +
        '</label><span class="collection-type-meta">' +
        prog.got +
        " / " +
        prog.total +
        "</span></div>";

      var thMutationCols = catTypes
        .map(function (ty) {
          return (
            '<th class="collection-matrix__th collection-matrix__th--mutation" scope="col" data-mutation="' +
            escapeHtml(ty.slug) +
            '" title="' +
            escapeHtml(ty.name || ty.slug) +
            '">' +
            escapeHtml(ty.name || ty.slug) +
            "</th>"
          );
        })
        .join("");

      var bodyRows = list
        .map(function (b) {
          var rowMutSlugs = catTypes
            .filter(function (ty) {
              return brainrotHasType(b, ty.slug);
            })
            .map(function (ty) {
              return ty.slug;
            })
            .join(" ");
          var mutationTds = catTypes
            .map(function (ty) {
              if (!brainrotHasType(b, ty.slug)) {
                return (
                  '<td class="collection-matrix__cell collection-matrix__cell--na" data-mutation="' +
                  escapeHtml(ty.slug) +
                  '"><span class="collection-matrix__na-mark" aria-hidden="true">—</span></td>'
                );
              }
              var key = b.slug + ":" + ty.slug;
              var chk =
                '<input type="checkbox" class="collection-claim" data-claim-key="' +
                escapeHtml(key) +
                '" ' +
                (claimedSet[key] ? "checked " : "") +
                (readOnly ? "disabled " : "") +
                'aria-label="' +
                escapeHtml(String(b.name || b.slug) + " — " + String(ty.name || ty.slug)) +
                '" />';
              return (
                '<td class="collection-matrix__cell collection-matrix__cell--claim" data-mutation="' +
                escapeHtml(ty.slug) +
                '">' +
                chk +
                "</td>"
              );
            })
            .join("");
          return (
            '<tr class="collection-matrix__row" data-name="' +
            escapeHtml((b.name || "").toLowerCase()) +
            '" data-search-haystack="' +
            escapeHtml(rowSearchHaystack(b, rarityLabel, catTypes)) +
            '" data-row-mutations="' +
            escapeHtml(rowMutSlugs) +
            '" data-rarity="' +
            escapeHtml(rarityLabel) +
            '">' +
            '<th scope="row" class="collection-matrix__name-cell">' +
            '<span class="collection-matrix__name-inner">' +
            '<span class="collection-matrix__name-thumb brainrot-thumb">' +
            nameColumnThumbInner(b) +
            "</span>" +
            '<span class="collection-matrix__name-text">' +
            escapeHtml(b.name) +
            "</span></span></th>" +
            mutationTds +
            "</tr>"
          );
        })
        .join("");

      var table =
        '<div class="collection-matrix-wrap">' +
        '<table class="collection-matrix" aria-label="' +
        escapeHtml(
          tx("collectionPage.tableAriaBrainrots", "{rarity} brainrots").replace(
            /\{rarity\}/g,
            formatRarityLabel(rarityLabel),
          ),
        ) +
        '">' +
        "<thead><tr>" +
        '<th class="collection-matrix__th collection-matrix__th--name" scope="col">' +
        escapeHtml(tx("collectionPage.colName", "Name")) +
        "</th>" +
        thMutationCols +
        "</tr></thead>" +
        "<tbody>" +
        bodyRows +
        "</tbody></table></div>";

      return (
        '<section class="collection-type-block collection-rarity-block" data-rarity-section="' +
        escapeHtml(rarityLabel) +
        '">' +
        head +
        table +
        "</section>"
      );
    }).join("");

    root.innerHTML =
      '<div class="collection-inner' +
      (preserveMissingView ? " collection-inner--missing-view" : "") +
      '" id="collection-inner">' +
      hero +
      variantTotalsHtml +
      toolbar +
      '<div class="collection-matrix-heading-wrap">' +
      '<h2 class="collection-h2" id="collection-matrix-heading">' +
      escapeHtml(
        preserveMissingView
          ? tx("collectionPage.headingMissingTables", "Missing to index")
          : tx("collectionPage.headingByRarity", "By game rarity"),
      ) +
      "</h2>" +
      '<button type="button" class="btn-secondary collection-missing-back-btn" id="collection-missing-back"' +
      (preserveMissingView ? "" : " hidden") +
      ">" +
      escapeHtml(tx("collectionPage.btnAllEntries", "Show full tracker")) +
      "</button></div>" +
      '<div class="collection-by-type">' +
      rarityBlocks +
      "</div></div>";

    function readStateFromDom() {
      var claimed = [];
      var wrap = root.querySelector(".collection-by-type");
      var hoEl = document.getElementById("collection-hide-from-others");
      var ho = hoEl ? !!hoEl.checked : state.hideFromOthers === true;
      if (!wrap) {
        return {
          v: 1,
          claimed: preserveExcludedRarityClaims([], state.claimed, brainrotsAll),
          typesDone: tdKeep.slice(),
          hideFromOthers: ho,
          notifyNewCodes: state.notifyNewCodes === true,
        };
      }
      wrap.querySelectorAll(".collection-claim:checked").forEach(function (inp) {
        var k = inp.getAttribute("data-claim-key");
        if (k) claimed.push(k);
      });
      claimed = preserveExcludedRarityClaims(claimed, state.claimed, brainrotsAll);
      return {
        v: 1,
        claimed: claimed,
        typesDone: tdKeep.slice(),
        hideFromOthers: ho,
        notifyNewCodes: state.notifyNewCodes === true,
      };
    }

    function applyRarityBulkClaim(rarityLabel, markChecked) {
      var list = buckets[rarityLabel] || [];
      var cur = readStateFromDom();
      var set = arrToSet(cur.claimed);
      var vEl = document.getElementById("collection-variant");
      var vSlug = vEl && vEl.value ? String(vEl.value) : "";
      var keys = collectClaimKeysForRarity(list, catTypes, vSlug);
      if (markChecked) {
        Object.keys(keys).forEach(function (k) {
          set[k] = true;
        });
      } else {
        Object.keys(keys).forEach(function (k) {
          delete set[k];
        });
      }
      var next = {
        v: 1,
        claimed: setToArr(set),
        typesDone: cur.typesDone,
        hideFromOthers: cur.hideFromOthers === true,
        notifyNewCodes: cur.notifyNewCodes === true,
      };
      persistLocal(next);
      scheduleCloudSave(next);
      renderCollectionUI(root, next, { readOnly: false });
    }

    function updateCollectionStatsDom(state) {
      var claimedSet = arrToSet(state.claimed);
      var totalN = countMatrixCells(brainrots);
      var n = countClaimedMatrix(claimedSet, brainrots);
      var missingN = totalN - n;
      if (missingN < 0) missingN = 0;
      var pct = totalN ? Math.round((n / totalN) * 1000) / 10 : 0;
      var nEl = document.getElementById("collection-stat-n");
      var pEl = document.getElementById("collection-stat-pct");
      var missEl = document.getElementById("collection-stat-missing");
      if (nEl) nEl.textContent = String(n);
      if (pEl) pEl.textContent = String(pct);
      if (missEl) missEl.textContent = String(missingN);
      var chipHost = document.getElementById("collection-variant-totals-chips");
      if (chipHost) {
        variantTotalsByMutation(claimedSet, brainrots, catTypes).forEach(function (row) {
          if (row.total <= 0) return;
          var nodes = chipHost.querySelectorAll(".collection-variant-chip");
          var ci;
          var chip = null;
          for (ci = 0; ci < nodes.length; ci++) {
            if (nodes[ci].getAttribute("data-mutation") === row.slug) {
              chip = nodes[ci];
              break;
            }
          }
          if (!chip) return;
          var fill = row.total > 0 ? row.got / row.total : 0;
          chip.style.setProperty("--fill", String(fill));
          chip.classList.toggle("collection-variant-chip--complete", row.total > 0 && row.got >= row.total);
          var g = chip.querySelector(".collection-variant-chip__got");
          var t = chip.querySelector(".collection-variant-chip__total");
          if (g) g.textContent = String(row.got);
          if (t) t.textContent = String(row.total);
          chip.setAttribute("title", row.label + " — " + row.got + " / " + row.total);
        });
      }
    }

    (function wireVariantTotalsToggle() {
      var totRoot = root.querySelector(".collection-variant-totals");
      var totToggle = document.getElementById("collection-variant-totals-toggle");
      var totPanel = document.getElementById("collection-variant-totals-panel");
      if (!totRoot || !totToggle || !totPanel) return;
      var LS_KEY = "stbarab_collection_variant_totals_v1";
      function applyVariantTotalsCollapsed(collapsed) {
        totRoot.classList.toggle("collection-variant-totals--collapsed", collapsed);
        totPanel.hidden = collapsed;
        totToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        totToggle.setAttribute(
          "aria-label",
          collapsed
            ? tx("collectionPage.variantTotalsExpand", "Show mutation totals")
            : tx("collectionPage.variantTotalsCollapse", "Hide mutation totals"),
        );
      }
      totToggle.addEventListener("click", function () {
        var next = !totRoot.classList.contains("collection-variant-totals--collapsed");
        applyVariantTotalsCollapsed(next);
        try {
          localStorage.setItem(LS_KEY, next ? "1" : "0");
        } catch (eLs) {}
      });
    })();

    var syncingRarityHeaderFromCell = false;

    function syncRaritySectionFromState(sectionEl, state) {
      if (!sectionEl) return;
      var rarityLabel = sectionEl.getAttribute("data-rarity-section");
      if (!rarityLabel) return;
      var list = buckets[rarityLabel] || [];
      var claimedSet = arrToSet(state.claimed);
      var vEl = document.getElementById("collection-variant");
      var vSlug = vEl && vEl.value ? String(vEl.value) : "";
      var prog = rarityTableProgress(claimedSet, list, catTypes, vSlug);
      var done = rarityAllClaimed(claimedSet, list, catTypes, vSlug);
      var meta = sectionEl.querySelector(".collection-type-meta");
      var cb = sectionEl.querySelector(".collection-rarity-done");
      if (meta) meta.textContent = prog.got + " / " + prog.total;
      if (cb && cb.checked !== done) {
        syncingRarityHeaderFromCell = true;
        try {
          cb.checked = done;
        } finally {
          syncingRarityHeaderFromCell = false;
        }
      }
    }

    var matrixRoot = root.querySelector(".collection-by-type");
    if (matrixRoot) {
      matrixRoot.querySelectorAll(".collection-claim").forEach(function (el) {
        el.addEventListener("change", function () {
          if (readOnly) return;
          var st = readStateFromDom();
          persistLocal(st);
          scheduleCloudSave(st);
          updateCollectionStatsDom(st);
          syncRaritySectionFromState(el.closest(".collection-rarity-block"), st);
          if (isMissingTablesView()) filterCollectionView();
        });
      });

      matrixRoot.querySelectorAll(".collection-rarity-done").forEach(function (el) {
        el.addEventListener("change", function () {
          if (readOnly) return;
          if (syncingRarityHeaderFromCell) return;
          var rarityLabel = el.getAttribute("data-rarity");
          if (!rarityLabel) return;
          var wantChecked = el.checked;
          el.checked = !wantChecked;
          var list = buckets[rarityLabel] || [];
          var vEl = document.getElementById("collection-variant");
          var vSlug = vEl && vEl.value ? String(vEl.value) : "";
          var keys = collectClaimKeysForRarity(list, catTypes, vSlug);
          var cellCount = Object.keys(keys).length;
          var rarityName = formatRarityLabel(rarityLabel);
          var variantNote = "";
          if (vSlug) {
            variantNote =
              " " +
              tx(
                "collectionPage.rarityConfirmVariantNote",
                "Only the {variant} column is affected (Show variant filter).",
              ).replace(/\{variant\}/g, collectionRarityConfirmVariantLabel(vSlug, catTypes));
          }
          var title;
          var body;
          var okLabel;
          if (wantChecked) {
            title = tx("collectionPage.rarityConfirmTitleMark", "Mark entire rarity?");
            body = tx(
              "collectionPage.rarityConfirmBodyMark",
              "This will mark {count} cells in {rarity} as collected.{variantNote}",
            )
              .replace(/\{count\}/g, String(cellCount))
              .replace(/\{rarity\}/g, rarityName)
              .replace(/\{variantNote\}/g, variantNote);
            okLabel = tx("collectionPage.rarityConfirmOkMark", "Mark all");
          } else {
            title = tx("collectionPage.rarityConfirmTitleClear", "Clear entire rarity?");
            body = tx(
              "collectionPage.rarityConfirmBodyClear",
              "This will clear {count} cells in {rarity}.{variantNote}",
            )
              .replace(/\{count\}/g, String(cellCount))
              .replace(/\{rarity\}/g, rarityName)
              .replace(/\{variantNote\}/g, variantNote);
            okLabel = tx("collectionPage.rarityConfirmOkClear", "Clear all");
          }
          openCollectionRarityConfirm({
            title: title,
            body: body,
            okLabel: okLabel,
            onConfirm: function () {
              el.checked = wantChecked;
              applyRarityBulkClaim(rarityLabel, wantChecked);
            },
          });
        });
      });

      matrixRoot.querySelectorAll(".collection-matrix-wrap").forEach(function (wrap) {
        wrap.addEventListener(
          "wheel",
          function (e) {
            if (wrap.scrollWidth <= wrap.clientWidth + 1) return;
            if (e.shiftKey) {
              wrap.scrollLeft += e.deltaY;
              e.preventDefault();
              return;
            }
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
              wrap.scrollLeft += e.deltaX;
              e.preventDefault();
            }
          },
          { passive: false }
        );
      });
    }

    var search = document.getElementById("collection-search");
    var rarity = document.getElementById("collection-rarity");
    var variant = document.getElementById("collection-variant");
    function rowMatchesVariant(tr, variantSlug) {
      if (!variantSlug) return true;
      var m = tr.getAttribute("data-row-mutations") || "";
      var parts = m.split(/\s+/).filter(Boolean);
      var i;
      for (i = 0; i < parts.length; i++) {
        if (parts[i] === variantSlug) return true;
      }
      return false;
    }

    /** When a variant is selected, show only that mutation column (plus Name). */
    function syncMutationColumnVisibility(variantSlug) {
      root.querySelectorAll("table.collection-matrix").forEach(function (table) {
        table.classList.toggle("collection-matrix--one-variant", !!variantSlug);
        table.querySelectorAll("th[data-mutation], td[data-mutation]").forEach(function (el) {
          var m = el.getAttribute("data-mutation");
          if (!variantSlug) {
            el.classList.remove("collection-matrix__mutation--off");
            el.removeAttribute("hidden");
          } else if (m === variantSlug) {
            el.classList.remove("collection-matrix__mutation--off");
            el.removeAttribute("hidden");
          } else {
            el.classList.add("collection-matrix__mutation--off");
            el.setAttribute("hidden", "hidden");
          }
        });
      });
    }

    function isMissingTablesView() {
      var btn = document.getElementById("collection-missing-view");
      return !!(btn && btn.getAttribute("aria-pressed") === "true");
    }

    function applyMissingTablesView(active) {
      var inner = document.getElementById("collection-inner");
      var btn = document.getElementById("collection-missing-view");
      var backBtn = document.getElementById("collection-missing-back");
      var heading = document.getElementById("collection-matrix-heading");
      var totals = root.querySelector(".collection-variant-totals");
      if (inner) inner.classList.toggle("collection-inner--missing-view", active);
      if (btn) {
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.classList.toggle("collection-missing-view-btn--active", active);
        btn.hidden = active;
        btn.textContent = tx("collectionPage.btnMissingTables", "Show missing to index");
      }
      if (backBtn) backBtn.hidden = !active;
      if (heading) {
        heading.textContent = active
          ? tx("collectionPage.headingMissingTables", "Missing to index")
          : tx("collectionPage.headingByRarity", "By game rarity");
      }
      if (totals) totals.classList.toggle("collection-variant-totals--view-hidden", active);
    }

    function setMissingTablesView(active) {
      applyMissingTablesView(active);
      try {
        localStorage.setItem("stbarab_collection_missing_view_v1", active ? "1" : "0");
      } catch (eLs) {}
      filterCollectionView();
    }

    function syncMissingMatrixCells() {
      var missingView = isMissingTablesView();
      var vEl = document.getElementById("collection-variant");
      var vSlug = vEl && vEl.value ? String(vEl.value) : "";
      root.querySelectorAll("table.collection-matrix").forEach(function (table) {
        table.classList.toggle("collection-matrix--missing-view", missingView);
        table.querySelectorAll(".collection-matrix__cell--indexed, .collection-matrix__col--complete").forEach(function (el) {
          el.classList.remove("collection-matrix__cell--indexed");
          el.classList.remove("collection-matrix__col--complete");
        });
        if (!missingView) {
          table.querySelectorAll("th[data-mutation], td[data-mutation]").forEach(function (el) {
            var m = el.getAttribute("data-mutation");
            if (!m) return;
            if (vSlug && m !== vSlug) return;
            if (!el.classList.contains("collection-matrix__mutation--off")) {
              el.removeAttribute("hidden");
            }
          });
          return;
        }
        table.querySelectorAll("td.collection-matrix__cell--claim").forEach(function (cell) {
          cell.classList.remove("collection-matrix__cell--indexed");
          if (cell.classList.contains("collection-matrix__mutation--off")) return;
          var inp = cell.querySelector(".collection-claim");
          var indexed = !!(inp && inp.checked);
          cell.classList.toggle("collection-matrix__cell--indexed", indexed);
          if (indexed) cell.setAttribute("hidden", "hidden");
          else cell.removeAttribute("hidden");
        });
        table.querySelectorAll("th.collection-matrix__th--mutation").forEach(function (th) {
          var m = th.getAttribute("data-mutation");
          if (!m || th.classList.contains("collection-matrix__mutation--off")) return;
          var hasOpen = false;
          var tds = table.querySelectorAll('td.collection-matrix__cell--claim[data-mutation="' + m + '"]');
          var ti;
          for (ti = 0; ti < tds.length; ti++) {
            var td = tds[ti];
            if (td.classList.contains("collection-matrix__mutation--off")) continue;
            if (!td.classList.contains("collection-matrix__cell--indexed")) {
              hasOpen = true;
              break;
            }
          }
          if (!hasOpen) {
            th.classList.add("collection-matrix__col--complete");
            th.setAttribute("hidden", "hidden");
            var tdi;
            for (tdi = 0; tdi < tds.length; tdi++) {
              tds[tdi].classList.add("collection-matrix__col--complete");
              tds[tdi].setAttribute("hidden", "hidden");
            }
            table.querySelectorAll('td.collection-matrix__cell--na[data-mutation="' + m + '"]').forEach(function (na) {
              na.classList.add("collection-matrix__col--complete");
              na.setAttribute("hidden", "hidden");
            });
          }
        });
      });
    }

    function rowHasMissingClaim(tr, variantSlug) {
      var cells = tr.querySelectorAll("td.collection-matrix__cell--claim");
      var ci;
      for (ci = 0; ci < cells.length; ci++) {
        var cell = cells[ci];
        if (cell.classList.contains("collection-matrix__mutation--off")) continue;
        if (variantSlug && cell.getAttribute("data-mutation") !== variantSlug) continue;
        var inp = cell.querySelector(".collection-claim");
        if (inp && !inp.checked) return true;
      }
      return false;
    }

    function filterCollectionView() {
      var q = (search && search.value ? search.value : "").trim().toLowerCase();
      var r = rarity && rarity.value ? rarity.value : "";
      var v = variant && variant.value ? variant.value : "";
      var missingView = isMissingTablesView();
      var hasFilter = !!(q || v || missingView);
      if (!missingView) {
        root.querySelectorAll(".collection-rarity-block").forEach(function (sec) {
          sec.hidden = false;
        });
        root.querySelectorAll(".collection-matrix__row").forEach(function (tr) {
          tr.hidden = false;
        });
      }
      root.querySelectorAll(".collection-rarity-block").forEach(function (sec) {
        var secR = sec.getAttribute("data-rarity-section");
        if (r && secR !== r) {
          sec.hidden = true;
          return;
        }
        sec.querySelectorAll(".collection-matrix__row").forEach(function (tr) {
          var hay =
            tr.getAttribute("data-search-haystack") ||
            tr.getAttribute("data-name") ||
            "";
          var searchHide = !!(q && hay.indexOf(q) < 0);
          var variantHide = v && !rowMatchesVariant(tr, v);
          var missingHide = missingView && !rowHasMissingClaim(tr, v);
          tr.hidden = searchHide || variantHide || missingHide;
        });
        if (hasFilter) {
          var hasMatch = sec.querySelector(".collection-matrix__row:not([hidden])");
          sec.hidden = !hasMatch;
        } else {
          sec.hidden = false;
        }
      });
      syncMutationColumnVisibility(v);
      syncMissingMatrixCells();
      var stAfter = readStateFromDom();
      root.querySelectorAll(".collection-rarity-block").forEach(function (sec) {
        syncRaritySectionFromState(sec, stAfter);
      });
    }
    if (search) search.addEventListener("input", filterCollectionView);
    if (rarity) rarity.addEventListener("change", filterCollectionView);
    if (variant) variant.addEventListener("change", filterCollectionView);
    function wireMissingViewToggle(el) {
      if (!el) return;
      el.addEventListener("click", function () {
        setMissingTablesView(!isMissingTablesView());
      });
    }
    wireMissingViewToggle(document.getElementById("collection-missing-view"));
    wireMissingViewToggle(document.getElementById("collection-missing-back"));
    if (search && preserveSearch) search.value = preserveSearch;
    if (rarity && preserveRarity && COLLECTION_RARITY_ORDER.indexOf(preserveRarity) >= 0) {
      rarity.value = preserveRarity;
    }
    if (variant && preserveVariant) variant.value = preserveVariant;
    filterCollectionView();

    var shareBtn = document.getElementById("collection-share");
    if (shareBtn) {
      var shareInFlight = false;
      function finishShareUi() {
        shareInFlight = false;
        shareBtn.disabled = false;
        shareBtn.removeAttribute("aria-busy");
      }
      shareBtn.addEventListener("click", function () {
        if (shareInFlight) return;
        shareInFlight = true;
        shareBtn.disabled = true;
        shareBtn.setAttribute("aria-busy", "true");
        var st = readStateFromDom();
        fetch(apiFetchPath("api/me"), { credentials: "include" })
          .then(function (r) {
            return r.json();
          })
          .catch(function () {
            return { ok: false };
          })
          .then(function (me) {
            if (!me || !me.user || !me.user.id) {
              throw new Error("need_login");
            }
            var uid = String(me.user.id);
            return fetch(apiFetchPath("api/collection"), {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                claimed: st.claimed,
                typesDone: st.typesDone,
                hideFromOthers: st.hideFromOthers === true,
                notifyNewCodes: st.notifyNewCodes === true,
              }),
            }).then(function (r) {
              if (r.status === 401) throw new Error("need_login");
              if (r.ok) return uid;
              return r.text().then(function (t) {
                var detail = "";
                try {
                  var j = JSON.parse(t);
                  if (j && j.error) detail = String(j.error);
                } catch (e) {}
                var ex = new Error("save_failed");
                ex.detail = detail;
                throw ex;
              });
            });
          })
          .then(function (uid) {
            var pfx = (window.STBARAB_APP_PATH_PREFIX || "").replace(/\/$/, "");
            var u =
              location.origin + pfx + "/collection?share=" + encodeURIComponent(uid);
            var out = document.getElementById("collection-share-out");
            if (!out) return;
            out.hidden = false;
            copyTextToClipboard(u, function (copied) {
              out.textContent = copied
                ? tx("collectionPage.shareCopied", "Copied to clipboard.")
                : tx("collectionPage.shareCopyManualPrefix", "Copy this link: ") + u;
              if (!copied) {
                try {
                  window.getSelection().removeAllRanges();
                  var r = document.createRange();
                  r.selectNodeContents(out);
                  window.getSelection().addRange(r);
                } catch (e) {}
              }
            });
            setTimeout(function () {
              out.hidden = true;
            }, 8000);
          })
          .catch(function (err) {
            if (err && err.message === "need_login") {
              alert(tx("collectionPage.alertDiscordForShare", "Log in with Discord to create a share link tied to your account."));
            } else {
              var extra =
                err && err.detail
                  ? "\n\n" + tx("collectionPage.alertShareServerDetail", "Server said:") + " " + err.detail
                  : "";
              alert(
                tx(
                  "collectionPage.alertShareSaveFailed",
                  "Could not save your collection to the server, so the share link was not created.",
                ) +
                  extra +
                  "\n\n" +
                  tx(
                    "collectionPage.alertShareMysqlHint",
                    "If you use MySQL for the collection API, check that the database is reachable. The app can also save under .data/collections/ when the DB fails — try again after restarting the server.",
                  ),
              );
            }
          })
          .then(function () {
            finishShareUi();
          });
      });
    }

    var mergeBtn = document.getElementById("collection-copy-merge");
    if (mergeBtn && readOnly) {
      mergeBtn.addEventListener("click", function () {
        var snap = shareSnapshot || defaultState();
        var local = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
        var merged = mergeState(local, snap);
        persistLocal(merged);
        scheduleCloudSave(merged);
        if (window.STBARAB_NAVIGATE) window.STBARAB_NAVIGATE("/collection");
        else location.href = "/collection";
      });
    }

    if (typeof window.STBARAB_HYDRATE_BRAINROT_THUMBS === "function") {
      window.STBARAB_HYDRATE_BRAINROT_THUMBS(root);
    }

    if (typeof document !== "undefined") {
      var bt = window.STBARAB_BASE_TITLE || "";
      if (readOnly) {
        var sharedTitle = ownerName
          ? tx("collectionPage.headlineUserCollection", "{name} Collection").replace(/\{name\}/g, String(ownerName))
          : tx("collectionPage.headlineShared", "Shared collection");
        document.title = sharedTitle + (bt ? " · " + bt : "");
      } else {
        document.title = tx("collectionPage.docTitle", "Collection Tracker") + (bt ? " · " + bt : "");
      }
    }
  }

  function bootstrap(root) {
    var params = new URLSearchParams(location.search);
    var share = params.get("share");
    var brainrots = window.STBARAB_BRAINROTS || [];

    if (share) {
      fetch(apiFetchPath("api/share/" + encodeURIComponent(share)))
        .then(function (r) {
          var st = r.status;
          return r.json().then(function (j) {
            j._httpStatus = st;
            return j;
          });
        })
        .then(function (j) {
          if (j && j._httpStatus === 403 && j.error === "private") {
            root.innerHTML =
              '<div class="collection-inner"><p class="empty-state">' +
              escapeHtml(tx("collectionPage.shareHiddenByOwner", "This collection is hidden by its owner.")) +
              '</p><a class="btn-secondary" href="/collection" data-spa-path="/collection">' +
              escapeHtml(tx("collectionPage.openTracker", "Open tracker")) +
              "</a></div>";
            return;
          }
          if (j && j.ok && j.data) {
            var snap = normalizeState(j.data);
            var on =
              j.ownerName != null && String(j.ownerName).trim() !== ""
                ? String(j.ownerName).trim()
                : "";
            renderCollectionUI(root, snap, {
              readOnly: true,
              shareSnapshot: snap,
              ownerName: on,
            });
          } else {
            root.innerHTML =
              '<div class="collection-inner"><p class="empty-state">' +
              escapeHtml(tx("collectionPage.shareInvalidOrExpired", "This share link is invalid or expired.")) +
              '</p><a class="btn-secondary" href="/collection" data-spa-path="/collection">' +
              escapeHtml(tx("collectionPage.openTracker", "Open tracker")) +
              "</a></div>";
          }
        })
        .catch(function () {
          root.innerHTML =
            '<div class="collection-inner"><p class="empty-state">' +
            escapeHtml(tx("collectionPage.shareLoadFailed", "Could not load share.")) +
            '</p><a class="btn-secondary" href="/collection" data-spa-path="/collection">' +
            escapeHtml(tx("collectionPage.openTracker", "Open tracker")) +
            "</a></div>";
        });
      return;
    }

    var local = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));

    fetch(apiFetchPath("api/me"), { credentials: "include" })
      .then(function (r) {
        return r.json();
      })
      .then(function (me) {
        if (!me || !me.user) {
          renderCollectionLoginGate(root);
          return;
        }
        return fetch(apiFetchPath("api/collection"), { credentials: "include" })
          .then(function (r) {
            return r.json();
          })
          .then(function (cloud) {
            if (cloud && cloud.ok && cloud.data) {
              renderCollectionUI(root, normalizeState(cloud.data), { readOnly: false });
            } else {
              renderCollectionUI(root, local, { readOnly: false });
            }
          })
          .catch(function () {
            renderCollectionUI(root, local, { readOnly: false });
          });
      })
      .catch(function () {
        renderCollectionLoginGate(root);
      });
  }

  window.STBARAB_RENDER_COLLECTION = function () {
    var root = document.getElementById("collection-root");
    if (!root) return;
    if (!window.STBARAB_BRAINROTS || !window.STBARAB_BRAINROTS.length) {
      root.innerHTML =
        '<div class="collection-inner"><p class="loading-state">' +
        escapeHtml(tx("brainrotsPage.loadingCatalog", "Loading catalog…")) +
        "</p></div>";
      return;
    }
    bootstrap(root);
  };

  window.STBARAB_LOAD_ACCOUNT_SETTINGS_STATE = function () {
    return fetch(apiFetchPath("api/me"), { credentials: "include" })
      .then(function (r) {
        return r.json();
      })
      .then(function (me) {
        if (!me || !me.user) {
          return { ok: true, loggedIn: false, state: null };
        }
        return fetch(apiFetchPath("api/collection"), { credentials: "include" })
          .then(function (r) {
            return r.json();
          })
          .then(function (cloud) {
            var local = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
            if (cloud && cloud.ok && cloud.data) {
              return { ok: true, loggedIn: true, state: normalizeState(cloud.data) };
            }
            return { ok: true, loggedIn: true, state: local };
          });
      });
  };

  window.STBARAB_SET_COLLECTION_PRIVACY = function (hideFromOthers) {
    return window.STBARAB_LOAD_ACCOUNT_SETTINGS_STATE().then(function (res) {
      if (!res || !res.loggedIn || !res.state) {
        return { ok: false, error: "not_logged_in" };
      }
      var st = res.state;
      st.hideFromOthers = !!hideFromOthers;
      persistLocal(st);
      scheduleCloudSave(st);
      return { ok: true, state: st };
    });
  };

  window.STBARAB_SET_CODES_NOTIFICATIONS = function (enabled) {
    return window.STBARAB_LOAD_ACCOUNT_SETTINGS_STATE().then(function (res) {
      if (!res || !res.loggedIn || !res.state) {
        return { ok: false, error: "not_logged_in" };
      }
      var st = res.state;
      st.notifyNewCodes = !!enabled;
      persistLocal(st);
      scheduleCloudSave(st);
      return { ok: true, state: st };
    });
  };

  window.STBARAB_GET_CODES_NOTIFICATIONS = function () {
    try {
      var st = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
      return st.notifyNewCodes === true;
    } catch (e) {
      return false;
    }
  };

})();
