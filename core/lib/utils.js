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

  /* ===== Safe AJAX wrapper =====
     Wraps any jQuery XHR promise so failures always resolve to [].
     On 429/503 it sets the global backoff clock.
  ===== */
  safeAjax: function (jqXhr, label) {
    var d = $.Deferred();
    jqXhr
      .done(function (data) {
        d.resolve(Array.isArray(data) ? data : (data || []));
      })
      .fail(function (xhr) {
        var status = xhr && xhr.status;
        if (status === 429 || status === 503) {
          var retryAfter = (xhr.getResponseHeader && parseInt(xhr.getResponseHeader("Retry-After"), 10)) || 0;
          F1Utils.setBackoff(retryAfter > 0 ? retryAfter * 1000 : 8000);
        }
        console.warn("[F1Utils] " + (label || "request") + " failed — status " + status);
        d.resolve([]);
      });
    return d.promise();
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
