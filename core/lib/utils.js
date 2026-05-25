var F1Utils = {

  /* ===== HTML Escaping ===== */
  escapeHtml: function (str) {
    str = String(str == null ? "" : str);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /* ===== Rate-limit backoff =====
     Repeated 429/503s within a minute escalate the wait exponentially (capped),
     with jitter so multiple tabs don't retry in lockstep. A clean response after
     things settle relaxes the escalation.
  ===== */
  _backoffUntil: 0,
  _backoffStreak: 0,
  _lastBackoffAt: 0,

  isBackingOff: function () {
    return Date.now() < F1Utils._backoffUntil;
  },

  setBackoff: function (ms) {
    var now = Date.now();
    if (now - F1Utils._lastBackoffAt < 60000) {
      F1Utils._backoffStreak = Math.min(F1Utils._backoffStreak + 1, 5);
    } else {
      F1Utils._backoffStreak = 1;
    }
    F1Utils._lastBackoffAt = now;

    var base   = ms || 8000;
    var factor = Math.pow(2, F1Utils._backoffStreak - 1); // 1, 2, 4, 8, 16
    var wait   = Math.min(base * factor, 120000);          // cap at 2 min
    wait      += Math.random() * Math.min(wait * 0.25, 2000);

    F1Utils._backoffUntil = now + wait;
    console.warn("[F1Utils] Rate-limited — backing off for " + Math.round(wait / 1000) + "s");
  },

  noteSuccess: function () {
    if (Date.now() - F1Utils._lastBackoffAt > 15000) {
      F1Utils._backoffStreak = 0;
    }
  },

  /* ===== Visibility =====
     True only when the element is actually laid out (not display:none, e.g. the
     track map hidden under the responsive breakpoint). Used to avoid polling for
     a widget the user can't see.
  ===== */
  isVisible: function (el) {
    if (typeof el === "string") el = document.getElementById(el);
    return !!el && el.offsetParent !== null && el.clientWidth > 0 && el.clientHeight > 0;
  },

  /* ===== Preferences ===== */
  getPrefs: function () {
    if (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load) {
      return UserPrefsModel.load();
    }
    return {};
  },

  /* ===== Dropdown label formatters (camelCase fields from PHP models) ===== */
  formatMeetingLabel: function (m) {
    var name = m.name || m.officialName || "Grand Prix";
    var d    = m.dateStart ? new Date(m.dateStart) : null;
    if (!d || isNaN(d.getTime())) return name;
    return name + " · " + d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  },

  formatSessionLabel: function (s) {
    var name = s.name || "Session";
    var d    = s.dateStart ? new Date(s.dateStart) : null;
    if (!d || isNaN(d.getTime())) return name;
    return name + " · " + d.toLocaleDateString(undefined, { weekday: "short" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  },

  /* ===== Skeleton-loading markup =====
     type: "card" (race grid) | "row" (table) | "item" (list)
  ===== */
  buildSkeleton: function (count, type) {
    var markup = {
      card: '<div class="skel skel-row" style="height:90px;border-radius:16px"></div>',
      row:  '<tr><td colspan="5"><div class="skel" style="height:36px;border-radius:8px;margin:4px 0"></div></td></tr>',
      item: '<div class="skel" style="height:56px;border-radius:12px;margin-bottom:8px"></div>'
    };
    var cell = markup[type] || markup.item;
    var html = "";
    for (var i = 0; i < count; i++) html += cell;
    return html;
  },

  /* ===== Formatting helpers ===== */
  pad2: function (n) {
    n = Number(n) || 0;
    return (n < 10 ? "0" : "") + n;
  },

  fmtLapTime: function (sec) {
    if (sec == null) return "—";
    var s = Number(sec);
    if (!isFinite(s) || s <= 0) return "—";
    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ":" + (r < 10 ? "0" : "") + r.toFixed(3);
  },

  /* ===== Toast notification =====
     Creates and auto-removes a .toast element.
  ===== */
  toast: function (msg, durationMs) {
    durationMs = durationMs || 2000;
    var $t = $("<div>").addClass("toast").text(msg);
    $("body").append($t);
    setTimeout(function () { $t.remove(); }, durationMs + 400);
  }
};
