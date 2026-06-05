(function (global) {
  "use strict";

  var deps = null;

  function tx(key, fallback) {
    return deps.translationTx ? deps.translationTx(key, fallback) : fallback;
  }
  var SPAWN_RATES_DISPLAY_ORDER = [
    "Common",
    "Rare",
    "Epic",
    "Legendary",
    "Mythic",
    "Brainrot God",
    "Secret",
    "Eternal",
    "LuckyRot",
    "Admin",
    "Goat",
  ];

  function spawnRarityDisplayOrderIndex(key) {
    var k = String(key == null ? "" : key);
    var i = SPAWN_RATES_DISPLAY_ORDER.indexOf(k);
    if (i >= 0) return i;
    if (k === "BrainrotGod") return SPAWN_RATES_DISPLAY_ORDER.indexOf("Brainrot God");
    return 999;
  }

  function sortSpawnRarityRowsForDisplay(rows) {
    return (rows || [])
      .slice()
      .sort(function (a, b) {
        var ia = spawnRarityDisplayOrderIndex(a.key);
        var ib = spawnRarityDisplayOrderIndex(b.key);
        if (ia !== ib) return ia - ib;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }

  function normalizeSpawnRatesPayload(j) {
    if (!j || typeof j !== "object") return { meta: {}, intro: [], rows: [] };
    return {
      meta: j.meta || {},
      intro: Array.isArray(j.intro) ? j.intro : [],
      rows: Array.isArray(j.rows) ? j.rows : [],
    };
  }

  function isSpawnCalcExcludedRarity(r) {
    if (!r) return true;
    if (r.key === "Admin") return true;
    if (
      String(r.name || "")
        .trim()
        .toLowerCase() === "admin"
    ) {
      return true;
    }
    return false;
  }

  function roundSpawnPercentNoise(p) {
    if (p !== p || p <= 0) return 0;
    p = +p;
    if (p < 0.0001) {
      return Math.round(p * 1e9) / 1e9;
    }
    return Math.round(p * 1e6) / 1e6;
  }

  function filterSpawnCalcRarityRows(rows, opts) {
    var o = opts && typeof opts === "object" ? opts : null;
    var includeAdmin = o && o.includeAdmin === true;
    var removedAdmin = false;
    var out = (rows || []).filter(function (r) {
      if (!r) return false;
      if (includeAdmin && r.key === "Admin") return true;
      if (isSpawnCalcExcludedRarity(r)) {
        if (r.key === "Admin") removedAdmin = true;
        return false;
      }
      return true;
    });
    var sum = 0;
    var i;
    for (i = 0; i < out.length; i++) {
      sum += out[i].p;
    }
    if (sum > 0 && out.length) {
      out = out.map(function (r) {
        return {
          name: r.name,
          key: r.key,
          p: roundSpawnPercentNoise((r.p / sum) * 100),
        };
      });
    }
    return { rows: out, removedAdmin: removedAdmin };
  }

  function brainrotTypeAvailabilityRowsKeyed() {
    var cat = deps.getTypesCatalog();
    var types = cat && Array.isArray(cat.types) ? cat.types : [];
    var brainrots = deps.getBrainrots();
    var total = brainrots.length;
    var out = [];
    if (!total || !types.length) return out;
    types.forEach(function (ty) {
      var slug = ty.slug;
      var n = 0;
      var i;
      var j;
      for (i = 0; i < brainrots.length; i++) {
        var b = brainrots[i];
        var tys = b.types;
        if (!tys || !tys.length) continue;
        for (j = 0; j < tys.length; j++) {
          if (tys[j] && tys[j].slug === slug) {
            n++;
            break;
          }
        }
      }
      out.push({
        name: ty.name || slug,
        slug: slug,
        p: (n / total) * 100,
        mult: (function () {
          var v = ty.multiplier;
          if (v == null || v === "") return null;
          if (typeof v === "number" && v === v && isFinite(v)) return v;
          var n = Number(String(v).trim());
          return Number.isFinite(n) ? n : null;
        })(),
      });
    });
    return out;
  }

  function luckTierFromSelect(luckVal) {
    var m = {
      "1": 0,
      "2": 1,
      "4": 2,
      "10": 3,
      "20": 4,
      "50": 5,
      "67": 6,
      "100": 7,
      "150": 8,
    };
    return m[luckVal] != null ? m[luckVal] : 0;
  }

  function rarityEventMultiplier(key, eventId) {
    if (!eventId || eventId === "none") {
      return 1.0;
    }
    var k = key || "";
    if (eventId === "crystal_hype") {
      if (k === "Secret" || k === "Eternal") return 1.32;
      if (k === "Brainrot God") return 1.25;
      if (k === "Mythic") return 1.16;
      if (k === "Legendary") return 1.1;
      if (k === "Epic") return 1.04;
      return 0.98;
    }
    if (eventId === "carnival_bump") {
      if (k === "LuckyRot") return 1.38;
      if (k === "Rare") return 1.12;
      if (k === "Common") return 0.94;
      return 1.02;
    }
    if (eventId === "fiesta") {
      if (k === "Epic" || k === "Legendary" || k === "Mythic") return 1.12;
      if (k === "Brainrot God" || k === "Secret") return 1.08;
      return 1.0;
    }
    return 1.0;
  }

  function typeEventMultiplier(slug, eventId) {
    var s = String(slug || "").toLowerCase();
    if (eventId === "crystal_hype") {
      if (s === "crystal" || s.indexOf("crystal") >= 0) return 1.55;
      if (s === "magical") return 1.55;
      return 0.98;
    }
    if (eventId === "carnival_bump") {
      if (s === "carnival") return 1.58;
      return 0.99;
    }
    if (eventId === "fiesta") {
      if (s === "gold" || s === "diamond" || s === "galaxy") return 1.1;
      return 1.0;
    }
    return 1.0;
  }

  function normalizeTypePercentMap(map) {
    var sum = 0;
    var k;
    for (k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) {
        var v = map[k];
        if (typeof v === "number" && v === v) sum += v;
      }
    }
    if (sum <= 0) return map;
    if (Math.abs(sum - 100) < 0.02) return map;
    var o = {};
    for (k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) {
        v = map[k];
        o[k] = typeof v === "number" && v === v ? (v / sum) * 100 : 0;
      }
    }
    return o;
  }

  function getOtherEventSplitFromLuck(luckId) {
    var lv = String(luckId || "1");
    if (lv === "1" || lv === "2") {
      return { d: 50, g: 15, di: 10, rem: 25 };
    }
    if (lv === "4") {
      return { d: 45, g: 15, di: 10, rem: 30 };
    }
    return { d: 35, g: 15, di: 10, rem: 40 };
  }

  function applyOtherEventTypeSplitToMap(luckId, bonusList) {
    var spl = getOtherEventSplitFromLuck(luckId);
    var raw = Array.isArray(bonusList) ? bonusList : [];
    var slugs = raw
      .map(function (s) {
        return String(s || "")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "");
      })
      .filter(function (s) {
        return s && s !== "default" && s !== "gold" && s !== "diamond";
      });
    if (!slugs.length) {
      slugs = ["crystal"];
    }
    var n = slugs.length;
    var each = spl.rem / n;
    var pctBySlug = { default: spl.d, gold: spl.g, diamond: spl.di };
    var j;
    for (j = 0; j < n; j++) {
      var sg = slugs[j];
      pctBySlug[sg] = (pctBySlug[sg] || 0) + each;
    }
    return normalizeTypePercentMap(pctBySlug);
  }

  function verseEventIdsMatch(storedId, wantedId) {
    var a = parseInt(storedId, 10);
    var b = parseInt(wantedId, 10);
    if (a === a && b === b) return a === b;
    return String(storedId) === String(wantedId);
  }

  function getVerseGameEventById(ref, id) {
    if (!ref || !Array.isArray(ref.verseGameEvents)) {
      return null;
    }
    var i;
    for (i = 0; i < ref.verseGameEvents.length; i++) {
      if (verseEventIdsMatch(ref.verseGameEvents[i].id, id)) {
        return ref.verseGameEvents[i];
      }
    }
    return null;
  }

  function getVerseEventBonusList(vcfg) {
    if (!vcfg) return null;
    if (Array.isArray(vcfg.bonus) && vcfg.bonus.length) {
      return vcfg.bonus;
    }
    if (vcfg.type && Array.isArray(vcfg.type.bonus) && vcfg.type.bonus.length) {
      return vcfg.type.bonus;
    }
    return null;
  }

  function getVerseEventFixedRates(vcfg) {
    if (!vcfg || !vcfg.fixedRates || typeof vcfg.fixedRates !== "object") {
      return null;
    }
    var out = {};
    var hasAny = false;
    for (var k in vcfg.fixedRates) {
      if (!Object.prototype.hasOwnProperty.call(vcfg.fixedRates, k)) continue;
      var key = String(k || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");
      if (!key) continue;
      var v = Number(vcfg.fixedRates[k]);
      if (!(v === v) || v < 0) continue;
      out[key] = v;
      hasAny = true;
    }
    return hasAny ? normalizeTypePercentMap(out) : null;
  }

  function resolveRarityProfileForSpawnEvent(evVal) {
    var ref = deps.getTypeSpawnEventTables();
    var e = String(evVal || "none");
    if (e === "none" || e === "") {
      return "none";
    }
    var m = /^v(\d+)$/.exec(e);
    if (m) {
      var vcfg = getVerseGameEventById(ref, parseInt(m[1], 10));
      if (vcfg && typeof vcfg.rarityProfile === "string" && vcfg.rarityProfile.trim() !== "") {
        return vcfg.rarityProfile.trim();
      }
    }
    return "none";
  }

  function getTypeNameForSlug(slug) {
    var s = String(slug || "");
    if (s === "ice-fire") return "Ice & Fire";
    var cat = deps.getTypesCatalog();
    if (cat && cat.types) {
      var i;
      for (i = 0; i < cat.types.length; i++) {
        if (cat.types[i].slug === s) {
          return String(cat.types[i].name || s);
        }
      }
    }
    return s;
  }

  function getTypeMultiplierForSlug(slug) {
    var s = String(slug || "");
    if (deps.getCatalogTypeMultiplier) {
      var cm = deps.getCatalogTypeMultiplier(s);
      if (typeof cm === "number" && cm === cm) return cm;
    }
    var cat = deps.getTypesCatalog();
    if (cat && cat.types) {
      var i;
      for (i = 0; i < cat.types.length; i++) {
        if (cat.types[i].slug === s) {
          var m = cat.types[i].multiplier;
          if (typeof m === "number" && m === m) return m;
        }
      }
    }
    return null;
  }

  function computeTypeSpawnFromEventTables(eventId, luckId) {
    var ref = deps.getTypeSpawnEventTables();
    if (!ref || !ref.withoutEvent || typeof ref.withoutEvent !== "object") {
      return null;
    }
    var meta = ref.meta || {};
    var eid = String(eventId || "none");
    var luck = String(luckId || "1");
    var pctBySlug = {};
    if (eid === "none" || eid === "") {
      var row = ref.withoutEvent[luck];
      if (!row) {
        var order = ["1", "2", "4", "10", "20", "50", "67", "100", "150"];
        var i;
        for (i = 0; i < order.length; i++) {
          if (ref.withoutEvent[order[i]]) {
            row = ref.withoutEvent[order[i]];
            break;
          }
        }
      }
      if (row) {
        for (var ks in row) {
          if (Object.prototype.hasOwnProperty.call(row, ks)) {
            var pv = row[ks];
            if (typeof pv === "number" && pv === pv) {
              pctBySlug[ks] = pv;
            }
          }
        }
      }
    } else {
      var vMatch = /^v(\d+)$/.exec(eid);
      if (vMatch) {
        var vcfg = getVerseGameEventById(ref, parseInt(vMatch[1], 10));
        var fixedRates = getVerseEventFixedRates(vcfg);
        if (fixedRates) {
          pctBySlug = fixedRates;
        } else {
          var bList = getVerseEventBonusList(vcfg);
          if (bList && bList.length) {
            pctBySlug = applyOtherEventTypeSplitToMap(luck, bList);
          }
        }
      }
    }
    pctBySlug = normalizeTypePercentMap(pctBySlug);
    var typeOrder = Array.isArray(ref.typeOrder) ? ref.typeOrder : [];
    var display = [];
    var seen = {};
    var j;
    for (j = 0; j < typeOrder.length; j++) {
      var slug = typeOrder[j];
      if (pctBySlug[slug] == null) continue;
      if (typeof pctBySlug[slug] !== "number" || pctBySlug[slug] < 0.0005) continue;
      seen[slug] = true;
      display.push({
        name: getTypeNameForSlug(slug),
        mult: getTypeMultiplierForSlug(slug),
        rate: formatSpawnRarityDisplayPct(pctBySlug[slug], 6),
        slug: slug,
      });
    }
    for (var extra in pctBySlug) {
      if (!Object.prototype.hasOwnProperty.call(pctBySlug, extra) || seen[extra]) continue;
      if (typeof pctBySlug[extra] === "number" && pctBySlug[extra] >= 0.0005) {
        display.push({
          name: getTypeNameForSlug(extra),
          mult: getTypeMultiplierForSlug(extra),
          rate: formatSpawnRarityDisplayPct(pctBySlug[extra], 6),
          slug: extra,
        });
      }
    }
    display.sort(function (a, b) {
      return parseFloat(b.rate) - parseFloat(a.rate);
    });
    if (!display.length) {
      return null;
    }
    return {
      model: {
        useFile: true,
        intro: [],
        note: "",
      },
      display: display,
    };
  }

  function mergeSecretEternalSpawnRows(rows) {
    var a = rows || [];
    var ps = 0;
    var pe = 0;
    var rest = [];
    var i;
    for (i = 0; i < a.length; i++) {
      var r = a[i];
      if (!r) continue;
      var k = r.key;
      if (k === "Secret") {
        var vs = r.p;
        if (typeof vs !== "number" || vs !== vs) vs = parseFloat(String(vs)) || 0;
        if (vs < 0) vs = 0;
        ps += vs;
        continue;
      }
      if (k === "Eternal") {
        var ve = r.p;
        if (typeof ve !== "number" || ve !== ve) ve = parseFloat(String(ve)) || 0;
        if (ve < 0) ve = 0;
        pe += ve;
        continue;
      }
      rest.push(r);
    }
    if (ps <= 0 && pe <= 0) {
      return a.slice();
    }
    rest.push({
      name: "Secret / Eternal",
      key: "Secret",
      p: roundSpawnPercentNoise(ps + pe),
    });
    return rest;
  }

  function defaultSpawnRarityIllustrativeRows() {
    return [
      { name: "Common", key: "Common", p: 32 },
      { name: "Rare", key: "Rare", p: 22 },
      { name: "Epic", key: "Epic", p: 16 },
      { name: "Legendary", key: "Legendary", p: 10 },
      { name: "Mythic", key: "Mythic", p: 8 },
      { name: deps.formatRarityLabel("Brainrot God"), key: "Brainrot God", p: 5 },
      { name: "Secret / Eternal", key: "Secret", p: 5 },
      { name: "Goat", key: "Goat", p: 1 },
      { name: deps.formatRarityLabel("LuckyRot"), key: "LuckyRot", p: 1 },
    ];
  }

  function getRaritySpawnBaseModel() {
    var file = normalizeSpawnRatesPayload(null);
    var useFile = file.rows && file.rows.length > 0;
    var meta = file.meta || {};
    var rows = [];
    if (useFile) {
      file.rows.forEach(function (row) {
        var p = parseFloat(String(row.rate));
        if (p !== p || p < 0) p = 0;
        var key = row.rarity
          ? deps.canonicalRarityBucketKey(row.rarity)
          : deps.matchRarityKeyFromLabel(String(row.name));
        rows.push({ name: String(row.name), key: key, p: p });
      });
    } else {
      rows = defaultSpawnRarityIllustrativeRows();
    }
    var fr = filterSpawnCalcRarityRows(rows, { includeAdmin: true });
    rows = fr.rows;
    var removedAdmin = fr.removedAdmin;
    rows.sort(function (a, b) {
      return b.p - a.p;
    });
    var defaultNote = useFile
      ? "Table from loaded rarity file (legacy)."
      : "Illustrative base rarity % (low tiers weighted higher) — not catalog counts. Shown when data/rarity_spawn_engine.json is unavailable; adjusted % use illustrative event + luck multipliers.";
    if (removedAdmin) {
      defaultNote += " The Admin tier is excluded here; other rows are renormalized to 100%.";
    }
    return {
      useFile: useFile,
      meta: meta,
      intro: useFile ? file.intro || [] : [],
      rows: rows,
      note: meta.note || defaultNote,
      removedAdmin: removedAdmin,
    };
  }

  function getRaritySpawnEnginePayload() {
    var e = deps.getRaritySpawnEnginePayload();
    if (e && typeof e === "object" && e.baseByLuck && typeof e.baseByLuck === "object") {
      return e;
    }
    return null;
  }

  function luckBandForRarityEventModifier(luckId) {
    var lv = String(luckId || "1");
    if (lv === "1") return "1";
    if (lv === "2") return "2";
    if (lv === "4") return "4";
    return "10plus";
  }

  function isLuckyRotVerseSpawnEvent(eventId) {
    var m = /^v(\d+)$/.exec(String(eventId || ""));
    return m && parseInt(m[1], 10) === 4;
  }

  function spawnEngineAddDelta(into, delta) {
    if (!into || !delta || typeof delta !== "object") return;
    var k;
    for (k in delta) {
      if (!Object.prototype.hasOwnProperty.call(delta, k)) continue;
      var v = delta[k];
      if (typeof v !== "number" || v !== v) continue;
      into[k] = (into[k] || 0) + v;
    }
  }

  function spawnEngineRowDisplayName(rarityKey) {
    if (rarityKey === "Secret") return "Secret / Eternal";
    if (rarityKey === "Brainrot God") return deps.formatRarityLabel("Brainrot God");
    if (rarityKey === "LuckyRot") return deps.formatRarityLabel("LuckyRot");
    return String(rarityKey);
  }

  function trimDecimalZerosDisplay(s) {
    if (s.indexOf("e") >= 0 || s.indexOf("E") >= 0) {
      s = String(Number(s));
    }
    if (s.indexOf(".") < 0) return s;
    s = s.replace(/(\.\d*?)0+$/, "$1");
    s = s.replace(/\.$/, "");
    return s;
  }

  function formatSpawnRarityDisplayPct(p, rowCount) {
    if (p !== p || p <= 0) return "0";
    p = roundSpawnPercentNoise(+p);
    if (p <= 0) return "0";
    var n = rowCount == null ? 6 : rowCount;
    var d;
    if (p >= 10) d = 1;
    else if (p >= 1) d = 2;
    else if (p >= 0.1) d = 3;
    else if (p >= 0.00005) d = 4;
    else d = 10;
    if (n < 8 && p >= 1) d = 2;
    var s = trimDecimalZerosDisplay(p.toFixed(d));
    if (p > 0 && (s === "0" || s === "")) {
      s = trimDecimalZerosDisplay(p.toFixed(12));
    }
    if (p > 0 && (s === "0" || s === "")) {
      s = p.toExponential(2);
    }
    return s === "" ? "0" : s;
  }

  function computeRarityRowsFromEngine(eventId, luckId, lobbyLevel) {
    var eng = getRaritySpawnEnginePayload();
    if (!eng) return null;
    var luck = String(luckId == null ? "1" : luckId);
    var base = eng.baseByLuck[luck];
    if (!base || typeof base !== "object") {
      return null;
    }
    var keys = Array.isArray(eng.rarityKeys) && eng.rarityKeys.length
      ? eng.rarityKeys.slice()
      : [
          "Common",
          "Rare",
          "Epic",
          "Legendary",
          "Mythic",
          "Brainrot God",
          "Secret",
          "LuckyRot",
          "Admin",
          "Goat",
        ];
    var raw = {};
    var i;
    var k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      var b = base[k];
      if (typeof b !== "number" || b !== b) b = 0;
      raw[k] = b;
    }
    var ev = String(eventId || "none");
    if (ev !== "none" && ev !== "") {
      var band = luckBandForRarityEventModifier(luck);
      var em =
        eng.eventModifierByLuckBand && eng.eventModifierByLuckBand[band]
          ? eng.eventModifierByLuckBand[band]
          : null;
      spawnEngineAddDelta(raw, em);
      if (isLuckyRotVerseSpawnEvent(ev) && eng.luckyRotEventExtra) {
        spawnEngineAddDelta(raw, eng.luckyRotEventExtra);
      }
    } else {
      var lvn = parseInt(luck, 10);
      if (lvn === 1 || lvn === 2 || lvn === 4) {
        var li = parseInt(String(lobbyLevel == null ? "1" : lobbyLevel), 10);
        if (li !== li || li < 1) li = 1;
        if (li > 10) li = 10;
        var lob = eng.lobbyByLevel && eng.lobbyByLevel[String(li)];
        spawnEngineAddDelta(raw, lob);
      }
    }
    var sum = 0;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      var v = raw[k];
      if (typeof v !== "number" || v !== v) v = 0;
      v = Math.max(0, v);
      raw[k] = v;
      sum += v;
    }
    if (sum <= 0) {
      return null;
    }
    var gBase = typeof base.Goat === "number" && base.Goat === base.Goat ? base.Goat : 0;
    var rG = raw["Goat"];
    if (typeof rG !== "number" || rG !== rG) rG = 0;
    rG = Math.max(0, rG);
    var goatUnchanged = gBase > 0 && Math.abs(rG - gBase) < 1e-12;
    var sumNoG = sum - rG;
    var useGoatPin = goatUnchanged && sumNoG > 1e-15;
    var rem = 100 - gBase;
    var rows = [];
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      var pct;
      if (useGoatPin) {
        if (k === "Goat") {
          pct = gBase;
        } else {
          pct = (raw[k] / sumNoG) * rem;
        }
      } else {
        pct = (raw[k] / sum) * 100;
      }
      rows.push({
        name: spawnEngineRowDisplayName(k),
        key: k,
        p: roundSpawnPercentNoise(pct),
      });
    }
    return mergeSecretEternalSpawnRows(rows);
  }

  function getTypeSpawnBaseModel() {
    var file = normalizeSpawnRatesPayload(deps.getBrainrotSpawnTypePayload());
    var useFile = file.rows && file.rows.length > 0;
    var meta = file.meta || {};
    var rows = [];
    if (useFile) {
      file.rows.forEach(function (row) {
        var p = parseFloat(String(row.rate));
        if (p !== p || p < 0) p = 0;
        var slug =
          row.slug != null && String(row.slug).trim() !== ""
            ? String(row.slug)
            : String(row.name || "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "") || "type";
        var mult = row.mult;
        if (typeof mult === "string" && mult !== "") {
          var mt = parseFloat(mult);
          mult = mt === mt ? mt : null;
        }
        rows.push({ name: String(row.name), slug: slug, p: p, mult: mult });
      });
    } else {
      rows = brainrotTypeAvailabilityRowsKeyed();
    }
    rows.sort(function (a, b) {
      return b.p - a.p;
    });
    return {
      useFile: useFile,
      meta: meta,
      intro: useFile ? file.intro || [] : [],
      rows: rows,
      note: meta.note != null && String(meta.note).trim() !== "" ? String(meta.note) : "",
    };
  }

  function computeSpawnAdjustedRarity(verseEventId, luckId, lobbyLevel) {
    var engineRows = computeRarityRowsFromEngine(verseEventId, luckId, lobbyLevel);
    if (engineRows && engineRows.length) {
      var eng = getRaritySpawnEnginePayload();
      var fr = filterSpawnCalcRarityRows(engineRows, { includeAdmin: true });
      var rowsF = sortSpawnRarityRowsForDisplay(fr.rows);
      var n = rowsF.length;
      var meta = (eng && eng.meta) || {};
      var noteFromMeta = meta.note;
      var defaultNote =
        noteFromMeta != null && String(noteFromMeta).trim() !== "" ? String(noteFromMeta) : "";
      var mEngine = {
        useFile: true,
        meta: meta,
        intro: Array.isArray(eng && eng.intro) ? eng.intro : [],
        note: defaultNote,
        removedAdmin: fr.removedAdmin,
        suppressAdminRenormNote: true,
        rows: rowsF,
      };
      return {
        model: mEngine,
        display: rowsF.map(function (r) {
          return {
            name: r.name,
            rate: formatSpawnRarityDisplayPct(r.p, n),
          };
        }),
      };
    }
    var profile = resolveRarityProfileForSpawnEvent(verseEventId);
    var m = getRaritySpawnBaseModel();
    var T = luckTierFromSelect(luckId);
    var n = m.rows.length;
    var rarityOrder = deps.getRarityOrder();
    var w = m.rows.map(function (r, i) {
      var base = r.p / 100;
      if (base < 0) base = 0;
      var rare = n <= 1 ? 0 : (n - 1 - i) / (n - 1);
      var luckM = 1 + T * 0.08 * rare;
      var ev = rarityEventMultiplier(r.key, profile);
      if (r.key) {
        var ri = rarityOrder.indexOf(r.key);
        if (ri >= 0) {
          luckM = 1 + T * 0.06 * (ri / 9);
        }
      }
      return base * ev * luckM;
    });
    var s = 0;
    w.forEach(function (x) {
      s += x;
    });
    if (s <= 0) s = 1;
    var j;
    var displayRows = [];
    for (j = 0; j < m.rows.length; j++) {
      displayRows.push({
        name: m.rows[j].name,
        key: m.rows[j].key,
        rate: formatSpawnRarityDisplayPct((w[j] / s) * 100, n),
      });
    }
    return {
      model: m,
      display: sortSpawnRarityRowsForDisplay(displayRows).map(function (r) {
        return { name: r.name, rate: r.rate };
      }),
    };
  }

  function ensureVerseGameEventOptions() {
    var sel = deps.$("#spawn-rates-event");
    if (!sel) return;
    var ref = deps.getTypeSpawnEventTables();
    if (!ref || !Array.isArray(ref.verseGameEvents) || !ref.verseGameEvents.length) {
      return;
    }
    var sig = ref.verseGameEvents
      .map(function (e) {
        return e.id + ":" + (e.label || "");
      })
      .join("|");
    if (sel.getAttribute("data-verse-sig") === sig) {
      var noneKeep = sel.querySelector('option[value="none"]');
      if (noneKeep) noneKeep.textContent = tx("spawnRatesPage.eventNone", "None");
      return;
    }
    var keep = sel.value;
    sel.innerHTML = "";
    var first = document.createElement("option");
    first.value = "none";
    first.textContent = tx("spawnRatesPage.eventNone", "None");
    sel.appendChild(first);
    ref.verseGameEvents
      .slice()
      .sort(function (a, b) {
        return a.id - b.id;
      })
      .forEach(function (ge) {
        var o = document.createElement("option");
        o.value = "v" + ge.id;
        o.textContent = ge.label || "Event " + ge.id;
        sel.appendChild(o);
      });
    sel.setAttribute("data-verse-sig", sig);
    if (
      keep === "none" ||
      (keep &&
        ref.verseGameEvents.some(function (x) {
          return "v" + x.id === keep;
        }))
    ) {
      sel.value = keep;
    } else {
      sel.value = "none";
    }
  }

  function computeSpawnAdjustedType(eventId, luckId) {
    var eid = String(eventId || "none");
    var fromRef = computeTypeSpawnFromEventTables(eventId, luckId);
    if (fromRef) {
      return { model: fromRef.model, display: fromRef.display };
    }
    if (eid !== "none" && eid !== "") {
      return { model: { useFile: true, intro: [], note: "" }, display: [] };
    }
    var m = getTypeSpawnBaseModel();
    var T = luckTierFromSelect(luckId);
    var n = m.rows.length;
    var w = m.rows.map(function (r, i) {
      var base = r.p / 100;
      if (base < 0) base = 0;
      var rare = n <= 1 ? 0 : (n - 1 - i) / (n - 1);
      var luckM = 1 + T * 0.07 * rare;
      var ev = typeEventMultiplier(r.slug, eventId);
      return base * ev * luckM;
    });
    var s = 0;
    w.forEach(function (x) {
      s += x;
    });
    if (s <= 0) s = 1;
    return {
      model: m,
      display: m.rows.map(function (r, i) {
        return {
          name: r.name,
          mult: r.mult,
          rate: formatSpawnRarityDisplayPct((w[i] / s) * 100, n),
        };
      }),
    };
  }

  var spawnRatesWired = false;

  function wireSpawnRatesOnce() {
    if (spawnRatesWired) return;
    spawnRatesWired = true;
    var ev = deps.$("#spawn-rates-event");
    var lu = deps.$("#spawn-rates-luck");
    var lb = deps.$("#spawn-rates-lobby");
    function go() {
      renderSpawnRatesPage();
    }
    if (ev) ev.addEventListener("change", go);
    if (lu) lu.addEventListener("change", go);
    if (lb) lb.addEventListener("change", go);
  }

  function spawnRatesViewQuery(sel) {
    var root = document.getElementById("view-spawn-rates");
    if (root && typeof root.querySelector === "function") {
      var hit = root.querySelector(sel);
      if (hit) return hit;
    }
    return deps.$(sel);
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

  function applySpawnRatesPageLastUpdated() {
    var el = spawnRatesViewQuery("#spawn-rates-page-updated");
    if (!el) return;
    var p = deps.getRaritySpawnEnginePayload();
    var meta = p && p.meta && typeof p.meta === "object" ? p.meta : null;
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
      deps.escapeHtml(tx("spawnRatesPage.lastUpdatedLabel", "Last updated: ")) +
      "</span>" +
      '<time class="page-last-updated__date" datetime="' +
      deps.escapeHtml(attr) +
      '">' +
      deps.escapeHtml(formatLastUpdatedDisplay(display)) +
      "</time>";
    el.hidden = false;
  }

  function renderSpawnRatesPage() {
    wireSpawnRatesOnce();
    try {
      ensureVerseGameEventOptions();
    } catch (e0) {
      /* ignore bad event table payload */
    }
    var ev =
      (spawnRatesViewQuery("#spawn-rates-event") && spawnRatesViewQuery("#spawn-rates-event").value) ||
      "none";
    var lu =
      (spawnRatesViewQuery("#spawn-rates-luck") && spawnRatesViewQuery("#spawn-rates-luck").value) || "1";
    var lobby =
      (spawnRatesViewQuery("#spawn-rates-lobby") && spawnRatesViewQuery("#spawn-rates-lobby").value) ||
      "1";
    var rOut;
    try {
      rOut = computeSpawnAdjustedRarity(ev, lu, lobby);
    } catch (eR) {
      rOut = {
        model: { note: String(eR && eR.message ? eR.message : eR), intro: [], removedAdmin: false },
        display: [],
      };
    }
    var tOut;
    try {
      tOut = computeSpawnAdjustedType(ev, lu);
    } catch (eT) {
      tOut = { model: { note: "", intro: [] }, display: [] };
    }
    var rDisp = Array.isArray(rOut.display) ? rOut.display : [];
    var tDisp = Array.isArray(tOut.display) ? tOut.display : [];
    var rModel = rOut.model || {};
    var tModel = tOut.model || {};
    var rEl = spawnRatesViewQuery("#spawn-rates-rarity");
    var tEl = spawnRatesViewQuery("#spawn-rates-type");
    var rNote = spawnRatesViewQuery("#spawn-rates-rarity-note");
    var tNote = spawnRatesViewQuery("#spawn-rates-type-note");
    var rIntro = spawnRatesViewQuery("#spawn-rates-rarity-intro");
    var tIntro = spawnRatesViewQuery("#spawn-rates-type-intro");

    if (rNote) {
      var rNoteText = rModel.note || "";
      if (rModel.removedAdmin && !rModel.suppressAdminRenormNote) {
        var adminExtra = tx(
          "spawnRatesPage.adminRenormNote",
          "The Admin tier is excluded here; other rows renormalize to 100%.",
        );
        var rLower = rNoteText.toLowerCase();
        if (
          rNoteText.indexOf(adminExtra) === -1 &&
          rLower.indexOf("admin tier is excluded") === -1 &&
          rLower.indexOf("omits the admin") === -1 &&
          rLower.indexOf("excluded here") === -1 &&
          rLower.indexOf("excluded") === -1
        ) {
          rNoteText += (rNoteText ? "\n\n" : "") + adminExtra;
        }
      }
      rNote.textContent = rNoteText;
      rNote.hidden = !rNoteText;
    }
    if (tNote) {
      tNote.textContent = tModel.note || "";
      tNote.hidden = !tModel.note;
    }
    function fillIntro(ul, lines) {
      if (!ul) return;
      if (!lines || !lines.length) {
        ul.innerHTML = "";
        ul.hidden = true;
        return;
      }
      ul.hidden = false;
      ul.innerHTML = lines
        .map(function (line) {
          return "<li>" + deps.escapeHtml(String(line)) + "</li>";
        })
        .join("");
    }
    fillIntro(rIntro, rModel.intro);
    fillIntro(tIntro, tModel.intro);

    if (rEl) {
      rEl.innerHTML =
        '<div class="lucky-table-wrap brainrots-rate-table-wrap"><table class="lucky-table"><thead><tr><th scope="col">' +
        deps.escapeHtml(tx("spawnRatesPage.thRarity", "Rarity")) +
        '</th><th scope="col" class="lucky-th-rate">' +
        deps.escapeHtml(tx("spawnRatesPage.thRate", "Rate")) +
        "</th></tr></thead><tbody>" +
        rDisp
          .map(function (r) {
            return (
              "<tr><td class=\"lucky-name\">" +
              deps.escapeHtml(String(r.name)) +
              '</td><td class="lucky-rate-cell">' +
              deps.luckyRateHtml(r.rate) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }
    if (tEl) {
      tEl.innerHTML =
        '<div class="lucky-table-wrap brainrots-rate-table-wrap"><table class="lucky-table"><thead><tr><th scope="col">' +
        deps.escapeHtml(tx("spawnRatesPage.thType", "Type")) +
        '</th><th scope="col" class="lucky-th-mult" title="' +
        deps.escapeAttr(tx("spawnRatesPage.thIncomeMultTitle", "Base income multiplier (from types)")) +
        '">' +
        deps.escapeHtml(tx("spawnRatesPage.thIncomeMult", "Income ×")) +
        '</th><th scope="col" class="lucky-th-rate">' +
        deps.escapeHtml(tx("spawnRatesPage.thRate", "Rate")) +
        "</th></tr></thead><tbody>" +
        tDisp
          .map(function (r) {
            var mult =
              r.mult != null && r.mult !== ""
                ? deps.formatMultiplier(typeof r.mult === "number" ? r.mult : Number(r.mult))
                : "—";
            return (
              "<tr><td class=\"lucky-name\">" +
              deps.escapeHtml(String(r.name)) +
              '</td><td class="lucky-rate-cell lucky-rate-cell--mult">' +
              deps.escapeHtml(mult) +
              '</td><td class="lucky-rate-cell">' +
              deps.luckyRateHtml(r.rate) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }
    applySpawnRatesPageLastUpdated();
  }

  /**
   * @param {object} ctx
   * @param {function(string, Element?): Element|null} ctx.$
   * @param {function(string): string} ctx.escapeHtml
   * @param {function(string): string} ctx.escapeAttr
   * @param {function(string, string): string} ctx.translationTx
   * @param {function(string): string} ctx.luckyRateHtml
   * @param {function(number): string} ctx.formatMultiplier
   * @param {function(string): string} ctx.formatRarityLabel
   * @param {function(string): string} ctx.canonicalRarityBucketKey
   * @param {function(string): string|null} ctx.matchRarityKeyFromLabel
   * @param {function(): string[]} ctx.getRarityOrder
   * @param {function(): unknown[]} ctx.getBrainrots
   * @param {function(): unknown | null} ctx.getTypesCatalog
   * @param {function(): unknown | null} ctx.getTypeSpawnEventTables
   * @param {function(): unknown | null} ctx.getRaritySpawnEnginePayload
   * @param {function(): unknown | null} ctx.getBrainrotSpawnTypePayload
   */
  function init(ctx) {
    deps = ctx;
    return { renderSpawnRatesPage: renderSpawnRatesPage };
  }

  global.STBGGSpawnRates = { init: init };
})(typeof window !== "undefined" ? window : this);
