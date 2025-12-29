var RacePage = (function () {

  var state = {
    meeting_key: null,
    session_key: null,
    session_start: null // ISO string
  };

  // ===== Replay =====
  var mode = "stopped"; // "playing" | "stopped"
  var replayTimer = null;

  // replay clock (ms UTC)
  var replayClockMs = 0;

  // how much replay time advances per real second
  var replaySpeed = 5; // 5x

  // caches (slow changing)
  var cache = {
    driversRaw: [],
    stints: [],
    pits: []
  };

  // polling frequency
  var lastSlowMs = 0;

  function init() {
    state.meeting_key = getMeetingKeyFromUrl();
    if (!state.meeting_key) {
      console.error("Missing meeting_key in URL");
      return;
    }

    $("#startBtn").on("click", startReplay);
    $("#stopBtn").on("click", stopReplay);

    $("#sessionSelect").on("change", function () {
      state.session_key = Number($("#sessionSelect").val()) || null;
      onSessionChanged();
    });

    loadSessionsForMeeting(state.meeting_key);
  }

  /* =========================
     Sessions
  ========================= */

  function loadSessionsForMeeting(meeting_key) {
    $("#sessionSelect").prop("disabled", true).empty();
    $("#sessionSelect").append('<option value="">Select session</option>');

    OpenF1API.sessions({ meeting_key: meeting_key })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        sessions.sort(function (a, b) { return Date.parse(a.date_start) - Date.parse(b.date_start); });

        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i];
          var label = s.session_name || ("Session " + s.session_key);
          $("#sessionSelect").append(
            '<option value="' + s.session_key + '" data-start="' + (s.date_start || "") + '">' +
              escapeHtml(label) +
            '</option>'
          );
        }

        // default: Race > Sprint > Quali > latest
        var best = F1Data.pickBestSession(sessions);
        state.session_key = best.session_key;
        state.session_start = best.date_start || null;

        $("#sessionSelect").val(String(state.session_key));
        $("#sessionSelect").prop("disabled", false);

        onSessionChanged();
      })
      .fail(function (xhr) {
        console.error("sessions failed", xhr);
        $("#sessionSelect").prop("disabled", false);
      });
  }

  function onSessionChanged() {
    stopReplay(); // reset UI + timers

    if (!state.session_key) return;

    // grab session_start from selected option
    var $opt = $("#sessionSelect option:selected");
    state.session_start = $opt.attr("data-start") || state.session_start;

    // load weather once (and you can still add auto-refresh later)
    WeatherData.getLatestForSession(state.session_key)
      .then(function (w) { WeatherData.renderToDashboard(w); })
      .catch(function (err) { console.error("weather failed", err); });

    // preload slow caches
    warmCaches(function () {
      // set replay clock to session start
      replayClockMs = state.session_start ? Date.parse(state.session_start) : Date.now();
      setStopwatchMs(0);

      // render once at start time (stopped state)
      tickReplay(true);
    });
  }

  /* =========================
     Replay start/stop + stopwatch
  ========================= */

  function startReplay() {
    if (!state.session_key) return;

    mode = "playing";
    $("#startBtn").prop("disabled", true);
    $("#stopBtn").prop("disabled", false);

    if (replayTimer) clearInterval(replayTimer);
    replayTimer = setInterval(function () {
      // advance replay time
      replayClockMs += replaySpeed * 1000;
      tickReplay(false);
    }, 1000);
  }

  function stopReplay() {
    mode = "stopped";

    if (replayTimer) clearInterval(replayTimer);
    replayTimer = null;

    $("#startBtn").prop("disabled", false);
    $("#stopBtn").prop("disabled", true);
  }

  function setStopwatchMs(msSinceStart) {
    if (msSinceStart < 0) msSinceStart = 0;

    var totalSeconds = Math.floor(msSinceStart / 1000);
    var hh = Math.floor(totalSeconds / 3600);
    var mm = Math.floor((totalSeconds % 3600) / 60);
    var ss = totalSeconds % 60;

    $("#stopwatch").text(
      pad2(hh) + ":" + pad2(mm) + ":" + pad2(ss)
    );
  }

  /* =========================
     Data fetch + render at a given replay time
  ========================= */

    function safeAjax(jqXhr, label) {
    var d = $.Deferred();
    jqXhr
        .done(function (data) { d.resolve(data); })
        .fail(function (xhr) {
        console.warn(label + " failed", xhr && xhr.status, xhr && xhr.responseText);
        d.resolve([]); // IMPORTANT: keep replay alive
        });
    return d.promise();
    }

    function warmCaches(done) {
    $.when(
        safeAjax(OpenF1API.drivers({ session_key: state.session_key }), "drivers"),
        safeAjax(OpenF1API.stints({ session_key: state.session_key }), "stints"),
        safeAjax(OpenF1API.pit({ session_key: state.session_key }), "pit")
    ).done(function (drv, st, pit) {
        cache.driversRaw = drv || [];
        cache.stints = st || [];
        cache.pits = pit || [];
        lastSlowMs = Date.now();
        done && done();
    });
    }


  function tickReplay(isInitial) {
    if (!state.session_key) return;

    // refresh slow caches every 30s during replay (optional)
    if (!isInitial && Date.now() - lastSlowMs > 30000) {
      warmCaches();
    }

    var sk = state.session_key;

    var tIso = new Date(replayClockMs).toISOString();

    // stopwatch = replayClock - session_start
    if (state.session_start) {
      setStopwatchMs(replayClockMs - Date.parse(state.session_start));
    }

    // keep windows small to avoid 422/429
    var fromIso = new Date(replayClockMs - 1500).toISOString(); // 1.5s before
    // NOTE: if you try to use an upper-bound filter and it fails, remove it.
    // We'll only use >= fromIso which is supported.

    $.when(
    // choose the latest records up to tIso
    safeAjax(OpenF1API.position({ session_key: sk, date: "<=" + tIso }), "position"),
    safeAjax(OpenF1API.intervals({ session_key: sk, date: "<=" + tIso }), "intervals"),

    // car_data is huge: only request a tiny recent slice
    safeAjax(OpenF1API.carData({ session_key: sk, date: ">=" + fromIso }), "car_data"),

    // laps: pick latest lap up to tIso
    safeAjax(OpenF1API.laps({ session_key: sk, date_start: "<=" + tIso }), "laps")
    ).done(function (pos, ints, car, laps) {

    var rows = TowerData.build({
        positions: pos || [],
        intervals: ints || [],
        stints: cache.stints || [],
        pits: cache.pits || [],
        laps: laps || [],
        drivers: F1Data.normalizeDrivers(cache.driversRaw || []),
        carData: car || []
    });

    TowerUI.render(rows);
    });

  }

  /* =========================
     Utils
  ========================= */

  function getMeetingKeyFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var mk = Number(p.get("meeting_key"));
    return mk || null;
  }

  function pad2(n) {
    n = Number(n) || 0;
    return (n < 10 ? "0" : "") + n;
  }

  function escapeHtml(str) {
    str = String(str == null ? "" : str);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return { init: init };
})();

$(document).ready(function () {
  RacePage.init();
});
