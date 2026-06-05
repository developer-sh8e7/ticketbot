(function (global) {
  "use strict";

  var deps = null;
  var tickTimer = null;
  var refreshTimer = null;
  var lastPayload = null;

  var EVENT_ICON_FILES = {
    rainbow: "Rainbow_Event.png",
    galaxy: "Galaxy_Event.png",
    zombie: "Zombie_Event.png",
    dreamy: "Dreamy_Event.png",
    fire_ice: "Ice___Fire_Event.png",
    ice_fire: "Ice___Fire_Event.png",
    zombie_fire_ice: "Ice___Fire_Event.png",
    carnival: "Carnival_Event.png",
    darkness: "Darkness_Event.png",
    aqua: "Underwater_Event.png",
    halloween: "Halloween_Event.png",
    galaxy_dreamy: "Galaxy_Event.png",
    neon: "Tokyo_Event.png",
    tokyo: "Tokyo_Event.png",
    new_season: "CRYSTAL_EVENT.png",
    chocolate: "Chocolate_Event.png",
    christmas: "Christmas_Event.png",
    toxic: "Toxic_Event.png",
    love: "Love_Event.png",
    void: "VOID_EVENT.png",
    heaven: "Heaven_Event.png",
    crystal: "CRYSTAL_EVENT.png",
    magical: "Magical_Event.png",
  };

  var EVENT_TEXT_MEDIA = {
    lucky_rot: { label: "Lucky Rot", kind: "lucky-rot" },
    luckyrot: { label: "Lucky Rot", kind: "lucky-rot" },
    admin: { label: "Admin Machine", kind: "admin" },
  };

  function tx(key, fallback) {
    return deps.translationTx ? deps.translationTx(key, fallback) : fallback;
  }

  function esc(s) {
    return deps.escapeHtml ? deps.escapeHtml(s) : String(s == null ? "" : s);
  }

  function escAttr(s) {
    return deps.escapeAttr ? deps.escapeAttr(s) : String(s == null ? "" : s);
  }

  function publicAsset(path) {
    return deps.publicAssetSrc ? deps.publicAssetSrc(path) : path;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatCountdownParts(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var d = Math.floor(s / 86400);
    s %= 86400;
    var h = Math.floor(s / 3600);
    s %= 3600;
    var m = Math.floor(s / 60);
    s %= 60;
    return { d: d, h: h, m: m, s: s };
  }

  function formatCountdown(sec) {
    var p = formatCountdownParts(sec);
    if (p.d > 0) return p.d + "d " + p.h + "h " + p.m + "m";
    if (p.h > 0) return p.h + "h " + pad2(p.m) + "m " + pad2(p.s) + "s";
    if (p.m > 0) return p.m + "m " + pad2(p.s) + "s";
    return p.s + "s";
  }

  function formatCycle(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    if (s < 60) return s + "s";
    if (s < 3600) return Math.round(s / 60) + " min";
    if (s % 3600 === 0) return s / 3600 + " h";
    return (s / 3600).toFixed(1) + " h";
  }

  function formatDuration(sec) {
    return formatCycle(sec);
  }

  function formatUnixUtc(unix) {
    if (!(unix > 0)) return "—";
    try {
      return new Date(unix * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
    } catch (eFmt) {
      return String(unix);
    }
  }

  function eventTextMedia(eventKey) {
    return EVENT_TEXT_MEDIA[String(eventKey || "").toLowerCase()] || null;
  }

  function eventIconSrc(eventKey) {
    if (eventTextMedia(eventKey)) return "";
    var key = String(eventKey || "").toLowerCase();
    var file = EVENT_ICON_FILES[key];
    if (!file) return "";
    return publicAsset("assets/images/Events/" + file);
  }

  function eventTextIconHtml(media, className) {
    var cls = className || "events-icon";
    return (
      '<span class="' +
      escAttr(cls) +
      " events-text-icon events-text-icon--" +
      escAttr(media.kind) +
      '">' +
      esc(media.label) +
      "</span>"
    );
  }

  function eventIconHtml(eventKey, className) {
    var textMedia = eventTextMedia(eventKey);
    if (textMedia) return eventTextIconHtml(textMedia, className);
    var icon = eventIconSrc(eventKey);
    var cls = className || "events-icon";
    if (icon) {
      return (
        '<img class="' +
        escAttr(cls) +
        '" src="' +
        escAttr(icon) +
        '" alt="" width="48" height="48" loading="lazy" decoding="async" />'
      );
    }
    return '<span class="' + escAttr(cls) + " " + escAttr(cls) + '--ph" aria-hidden="true">?</span>';
  }

  function eventHeroMediaHtml(eventKey) {
    var textMedia = eventTextMedia(eventKey);
    if (textMedia) {
      return (
        '<div class="events-live__media events-live__media--text">' +
        '<span class="events-text-hero events-text-hero--' +
        escAttr(textMedia.kind) +
        '">' +
        esc(textMedia.label) +
        "</span></div>"
      );
    }
    var icon = eventIconSrc(eventKey);
    if (icon) {
      return (
        '<div class="events-live__media">' +
        '<img class="events-live__hero-img" src="' +
        escAttr(icon) +
        '" alt="" decoding="async" loading="eager" onerror="this.closest(\'.events-live__media\').classList.add(\'is-missing\');this.remove()" />' +
        "</div>"
      );
    }
    return (
      '<div class="events-live__media is-missing"><span class="events-live__hero-ph" aria-hidden="true">?</span></div>'
    );
  }

  function timerWrapHtml(unixUntil, timerClass) {
    var sec = Math.max(0, Math.floor(Number(unixUntil) || 0) - Math.floor(Date.now() / 1000));
    return (
      '<div class="events-live__timer">' +
      timerDigitsHtml(sec, timerClass || "events-timer--hero", unixUntil) +
      "</div>"
    );
  }

  function timerDigitsHtml(sec, sizeClass, unixUntil) {
    var p = formatCountdownParts(sec);
    var cls = "events-timer " + (sizeClass || "");
    var untilAttr =
      unixUntil > 0
        ? ' data-countdown-until="' +
          escAttr(String(unixUntil)) +
          '" data-timer-class="' +
          escAttr(sizeClass || "events-timer--hero") +
          '"'
        : "";
    if (p.d > 0) {
      return (
        '<div class="' +
        escAttr(cls) +
        '" role="timer"' +
        untilAttr +
        ">" +
        '<span class="events-timer__unit"><span class="events-timer__val">' +
        esc(String(p.d)) +
        '</span><span class="events-timer__lbl">' +
        esc(tx("eventsPage.unitDays", "days")) +
        "</span></span>" +
        '<span class="events-timer__sep">:</span>' +
        '<span class="events-timer__unit"><span class="events-timer__val">' +
        esc(pad2(p.h)) +
        '</span><span class="events-timer__lbl">' +
        esc(tx("eventsPage.unitHrs", "hrs")) +
        "</span></span>" +
        '<span class="events-timer__sep">:</span>' +
        '<span class="events-timer__unit"><span class="events-timer__val">' +
        esc(pad2(p.m)) +
        '</span><span class="events-timer__lbl">' +
        esc(tx("eventsPage.unitMin", "min")) +
        "</span></span>" +
        '<span class="events-timer__sep">:</span>' +
        '<span class="events-timer__unit"><span class="events-timer__val">' +
        esc(pad2(p.s)) +
        '</span><span class="events-timer__lbl">' +
        esc(tx("eventsPage.unitSec", "sec")) +
        "</span></span></div>"
      );
    }
    return (
      '<div class="' +
      escAttr(cls) +
      '" role="timer"' +
      untilAttr +
      ">" +
      '<span class="events-timer__unit"><span class="events-timer__val">' +
      esc(pad2(p.h)) +
      '</span><span class="events-timer__lbl">' +
      esc(tx("eventsPage.unitHrs", "hrs")) +
      "</span></span>" +
      '<span class="events-timer__sep">:</span>' +
      '<span class="events-timer__unit"><span class="events-timer__val">' +
      esc(pad2(p.m)) +
      '</span><span class="events-timer__lbl">' +
      esc(tx("eventsPage.unitMin", "min")) +
      "</span></span>" +
      '<span class="events-timer__sep">:</span>' +
      '<span class="events-timer__unit"><span class="events-timer__val">' +
      esc(pad2(p.s)) +
      '</span><span class="events-timer__lbl">' +
      esc(tx("eventsPage.unitSec", "sec")) +
      "</span></span></div>"
    );
  }

  function progressPct(remaining, duration) {
    var d = Math.max(1, Number(duration) || 1);
    var r = Math.max(0, Math.min(d, Number(remaining) || 0));
    return Math.round((r / d) * 100);
  }

  function liveHeroHtml(live, next, meta) {
    if (!live) {
      if (next) {
        return (
          '<article class="events-live events-live--idle">' +
          '<span class="events-live__badge events-live__badge--idle">' +
          esc(tx("eventsPage.noActive", "No event active right now")) +
          "</span>" +
          '<div class="events-live__layout">' +
          eventHeroMediaHtml(next.eventKey) +
          '<div class="events-live__panel">' +
          '<p class="events-live__phase">' +
          esc(tx("eventsPage.upNextTitle", "Up next")) +
          "</p>" +
          '<h2 class="events-live__title">' +
          esc(next.label || next.eventKey) +
          "</h2>" +
          '<p class="events-live__sub">' +
          esc(tx("eventsPage.startsIn", "Starts in")) +
          "</p>" +
          timerWrapHtml(next.startsAt, "events-timer--hero") +
          "</div></div></article>"
        );
      }
      return (
        '<p class="events-empty">' +
        esc(tx("eventsPage.noSchedule", "No upcoming events could be calculated.")) +
        "</p>"
      );
    }
    var dur = live.durationSec || (meta && meta.defaultEventDurationSec) || 1200;
    var pct = progressPct(
      live.windowEnd != null ? Math.max(0, live.windowEnd - Math.floor(Date.now() / 1000)) : live.secondsRemaining,
      dur,
    );
    var nextBlock = "";
    if (next && next.eventKey !== live.eventKey && next.startsAt) {
      nextBlock =
        '<div class="events-live__next">' +
        '<p class="events-live__next-label">' +
        esc(tx("eventsPage.upNextTitle", "Up next")) +
        "</p>" +
        '<p class="events-live__next-name">' +
        esc(next.label || next.eventKey) +
        ' <span class="events-live__next-in" data-countdown-until="' +
        escAttr(String(next.startsAt)) +
        '">' +
        esc(formatCountdown(Math.max(0, next.startsAt - Math.floor(Date.now() / 1000)))) +
        "</span></p></div>";
    }
    return (
      '<article class="events-live is-active">' +
      '<span class="events-live__badge">' +
      esc(tx("eventsPage.liveNow", "Live now")) +
      "</span>" +
      '<div class="events-live__layout">' +
      eventHeroMediaHtml(live.eventKey) +
      '<div class="events-live__panel">' +
      '<h2 class="events-live__title">' +
      esc(live.label || live.eventKey) +
      "</h2>" +
      '<p class="events-live__sub">' +
      esc(tx("eventsPage.endsIn", "Ends in")) +
      "</p>" +
      timerWrapHtml(live.windowEnd, "events-timer--hero") +
      '<div class="events-progress" aria-hidden="true" data-progress-until="' +
      escAttr(String(live.windowEnd)) +
      '" data-progress-duration="' +
      escAttr(String(dur)) +
      '">' +
      '<div class="events-progress__bar" style="width:' +
      escAttr(String(pct)) +
      '%"></div></div>' +
      '<p class="events-live__meta">' +
      esc(tx("eventsPage.cycleEvery", "Cycle")) +
      ": " +
      esc(formatCycle(live.cycleSec)) +
      "</p>" +
      nextBlock +
      "</div></div></article>"
    );
  }

  function tableRowsHtml(schedule) {
    var rows = schedule && Array.isArray(schedule.perEvent) ? schedule.perEvent : [];
    var enabled = rows.filter(function (r) {
      return r && r.enabled;
    });
    enabled.sort(function (a, b) {
      var au = a.secondsUntil;
      var bu = b.secondsUntil;
      if (au == null && bu == null) return 0;
      if (au == null) return 1;
      if (bu == null) return -1;
      return au - bu;
    });
    if (!enabled.length) return "";
    var html = enabled
      .map(function (row) {
        var ev = row.event || {};
        var label = ev.label || ev.eventKey;
        var cls = row.active ? " is-active" : "";
        return (
          "<tr class=\"events-row" +
          cls +
          '" data-event-key="' +
          escAttr(ev.eventKey) +
          '"><td class="events-row__cell-icon">' +
          eventIconHtml(ev.eventKey, "events-row__icon") +
          '</td><td><span class="events-row__name">' +
          esc(label) +
          "</span></td><td>" +
          esc(formatCycle(row.cycleSec)) +
          "</td><td>" +
          (row.nextStart
            ? '<span class="events-row__in" data-countdown-until="' +
              escAttr(String(row.nextStart)) +
              '">' +
              esc(formatCountdown(row.secondsUntil)) +
              "</span>"
            : "—") +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="events-table-wrap"><table class="events-table"><thead><tr>' +
      "<th></th><th>" +
      esc(tx("eventsPage.colEvent", "Event")) +
      "</th><th>" +
      esc(tx("eventsPage.colCycle", "Cycle")) +
      "</th><th>" +
      esc(tx("eventsPage.colIn", "Next one in")) +
      "</th></tr></thead><tbody>" +
      html +
      "</tbody></table></div>"
    );
  }

  function applyTimerDigits(timerEl, sec) {
    var p = formatCountdownParts(sec);
    var vals = timerEl.querySelectorAll(".events-timer__val");
    if (vals.length >= 4) {
      vals[0].textContent = String(p.d);
      vals[1].textContent = pad2(p.h);
      vals[2].textContent = pad2(p.m);
      vals[3].textContent = pad2(p.s);
      return;
    }
    if (vals.length >= 3) {
      vals[0].textContent = pad2(p.h);
      vals[1].textContent = pad2(p.m);
      vals[2].textContent = pad2(p.s);
    }
  }

  function refreshCountdownNodes(root, now) {
    var nodes = root.querySelectorAll("[data-countdown-until]");
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var until = parseInt(node.getAttribute("data-countdown-until"), 10);
      if (!(until > 0)) continue;
      var sec = Math.max(0, until - now);
      if (node.classList.contains("events-timer")) {
        applyTimerDigits(node, sec);
        continue;
      }
      if (node.classList.contains("events-live__timer")) {
        var wrapTimer = node.querySelector(".events-timer[data-countdown-until]");
        if (wrapTimer) {
          applyTimerDigits(wrapTimer, sec);
          continue;
        }
        var legacyTimer = node.querySelector(".events-timer");
        if (legacyTimer) {
          var legacyCls = node.getAttribute("data-timer-class") || "events-timer--hero";
          legacyTimer.outerHTML = timerDigitsHtml(sec, legacyCls, until);
        }
        continue;
      }
      node.textContent = formatCountdown(sec);
    }
    var progress = root.querySelector("[data-progress-until]");
    if (progress) {
      var end = parseInt(progress.getAttribute("data-progress-until"), 10);
      var dur = parseInt(progress.getAttribute("data-progress-duration"), 10) || 1200;
      var bar = progress.querySelector(".events-progress__bar");
      if (bar && end > 0) {
        bar.style.width = String(progressPct(Math.max(0, end - now), dur)) + "%";
      }
    }
  }

  function eventsViewVisible() {
    var view = document.getElementById("view-events");
    return !!(view && !view.hidden);
  }

  function tickCountdowns() {
    var root = document.getElementById("events-root");
    if (!root || !eventsViewVisible()) return;
    if (!root.querySelector("[data-countdown-until]")) return;
    var now = Math.floor(Date.now() / 1000);
    refreshCountdownNodes(root, now);
  }

  function renderEventsPage(payload) {
    var root = document.getElementById("events-root");
    if (!root) return;
    lastPayload = payload;
    if (!payload || !payload.ok) {
      root.innerHTML =
        '<div class="events-inner"><p class="empty-state">' +
        esc(tx("eventsPage.loadError", "Could not load event schedule.")) +
        "</p></div>";
      return;
    }
    var schedule = payload.schedule;
    var live = payload.live || (payload.current && payload.current[0]) || null;
    var next = payload.next || null;
    root.innerHTML =
      '<div class="events-inner">' +
      '<header class="events-head"><h1 class="events-title">' +
      esc(tx("eventsPage.title", "Events")) +
      "</h1></header>" +
      liveHeroHtml(live, next, payload.meta) +
      '<section class="events-all"><h2 class="events-all__title">' +
      esc(tx("eventsPage.allEvents", "Event Rotations")) +
      "</h2>" +
      tableRowsHtml(schedule) +
      "</section></div>";
    tickCountdowns();
    startTick();
  }

  function scheduleHasData(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (payload.ok === true) return true;
    if (payload.live || payload.next) return true;
    if (payload.current && payload.current.length) return true;
    if (payload.schedule && typeof payload.schedule === "object") return true;
    if (payload.events && payload.events.length) return true;
    return false;
  }

  function liveFromScheduleRow(row) {
    if (!row || !row.event) return null;
    return {
      eventKey: row.event.eventKey,
      label: row.event.label,
      windowEnd: row.windowEnd,
      durationSec: row.durationSec,
      cycleSec: row.cycleSec,
    };
  }

  function nextFromScheduleRow(row) {
    if (!row || !row.event) return null;
    return {
      eventKey: row.event.eventKey,
      label: row.event.label,
      startsAt: row.nextStart,
    };
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    if (payload.ok === true && payload.schedule) return payload;
    var sch = payload.schedule;
    if (sch && sch.perEvent) {
      return {
        ok: true,
        nowUnix: sch.nowUnix,
        nowIso: sch.nowIso,
        live: payload.live || liveFromScheduleRow(sch.live),
        next: payload.next || nextFromScheduleRow(sch.upNext),
        meta: payload.meta || {},
        events: payload.events || [],
        schedule: sch,
      };
    }
    return payload;
  }

  function fetchPayload() {
    var boot = deps.getBootSchedule ? deps.getBootSchedule() : null;
    var url = deps.siteApiUrl ? deps.siteApiUrl("api/realtime-events") : "";
    if (!url) return Promise.resolve(scheduleHasData(boot) ? normalizePayload(boot) : null);
    return fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        return scheduleHasData(j) ? normalizePayload(j) : scheduleHasData(boot) ? normalizePayload(boot) : null;
      })
      .catch(function () {
        return scheduleHasData(boot) ? normalizePayload(boot) : null;
      });
  }

  function refresh() {
    return fetchPayload().then(function (payload) {
      renderEventsPage(payload);
      return payload;
    });
  }

  function startTick() {
    if (tickTimer) clearInterval(tickTimer);
    if (refreshTimer) clearInterval(refreshTimer);
    tickCountdowns();
    tickTimer = setInterval(tickCountdowns, 1000);
    refreshTimer = setInterval(function () {
      if (!eventsViewVisible()) return;
      refresh();
    }, 60000);
  }

  function renderEventsPageRoute(opts) {
    var root = document.getElementById("events-root");
    if (!root) return;
    var soft = opts && opts.soft;
    if (!soft && !root.querySelector(".events-live, .events-table-wrap")) {
      root.innerHTML =
        '<div class="events-inner"><p class="loading-state">' +
        esc(tx("eventsPage.loading", "Loading event schedule…")) +
        "</p></div>";
    }
    refresh();
  }

  function init(ctx) {
    deps = ctx;
    return { renderEventsPageRoute: renderEventsPageRoute };
  }

  global.STBGGEvents = { init: init };
})(typeof window !== "undefined" ? window : this);
