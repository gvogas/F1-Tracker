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

  /* ===== Rate-limit backoff ===== */
  _backoffUntil: 0,

  isBackingOff: function () {
    return Date.now() < F1Utils._backoffUntil;
  },

  setBackoff: function (ms) {
    ms = ms || 8000;
    F1Utils._backoffUntil = Date.now() + ms;
    console.warn("[F1Utils] Rate-limited — backing off for " + (ms / 1000) + "s");
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
