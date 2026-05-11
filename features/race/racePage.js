var RacePage = (function () {

  var state = {
    meeting_key:   null,
    session_key:   null,
    session_start: null // ISO string
  };

  // ===== Replay =====
  var mode = "stopped"; // "playing" | "stopped"
  var replayTimer = null;

  // replay clock (ms UTC)
  var replayClockMs = 0;

  // how much replay time advances per real second
  var replaySpeed = 5; // 5× default

  // caches (slow changing)
  var cache = {
    driversRaw: [],
    stints: [],
    pits: []
  };

  var lastSlowMs = 0;

  /* ===== Init ===== */
  function init() {
    HeaderModel.createHeader();

    state.meeting_key = getMeetingKeyFromUrl();
    if (!state.meeting_key) {
      showError("No meeting selected. Please go to Races and pick a session.");
      return;
    }

    // Speed buttons
    $(document).on("click", ".speed-btn", function () {
      replaySpeed = Number($(this).attr("data-speed")) || 5;
      $(".speed-btn").removeClass("is-active");
      $(this).addClass("is-active");
    });

    $("#startBtn").on("click", startReplay);
    $("#stopBtn").on("click", stopReplay);

    $("#sessionSelect").on("change", function () {
      state.session_key = Number($("#sessionSelect").val()) || null;
      onSessionChanged();
    });

    loadSessionsForMeeting(state.meeting_key);
  }

  /* ===== Sessions ===== */
  function loadSessionsForMeeting(meeting_key) {
    $("#sessionSelect").prop("disabled", true).empty();
    $("#sessionSelect").append('<option value="">Loading sessions…</option>');

    OpenF1API.sessions({ meeting_key: meeting_key })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        sessions.sort(function (a, b) {
          return Date.parse(a.date_start) - Date.parse(b.date_start);
        });

        $("#sessionSelect").empty();
        $("#sessionSelect").append('<option value="">— Select session —</option>');

        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i];
          var label = s.session_name || ("Session " + s.session_key);
          var d = s.date_start ? new Date(s.date_start) : null;
          if (d && !isNaN(d)) {
            label += " · " + d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          }
          $("#sessionSelect").append(
            '<option value="' + s.session_key + '" data-start="' + (s.date_start || "") + '">' +
              F1Utils.escapeHtml(label) +
            '</option>'
          );
        }

        var best = F1Data.pickBestSession(sessions);
        state.session_key   = best.session_key;
        state.session_start = best.date_start || null;

        $("#sessionSelect").val(String(state.session_key));
        $("#sessionSelect").prop("disabled", false);

        onSessionChanged();
      })
      .fail(function () {
        showError("Failed to load sessions. Check your connection.");
        $("#sessionSelect").prop("disabled", false);
      });
  }

  function onSessionChanged() {
    stopReplay();

    if (!state.session_key) return;

    var $opt = $("#sessionSelect option:selected");
    state.session_start = $opt.attr("data-start") || state.session_start;

    // Load weather
    WeatherData.getLatestForSession(state.session_key)
      .then(function (w) { WeatherData.renderToDashboard(w); })
      .catch(function () {});

    // Preload slow caches then set initial replay position
    warmCaches(function () {
      replayClockMs = state.session_start ? Date.parse(state.session_start) : Date.now();
      setStopwatchMs(0);
      tickReplay(true);
    });
  }

  /* ===== Replay start/stop ===== */
  function startReplay() {
    if (!state.session_key) return;

    mode = "playing";
    $("#startBtn").prop("disabled", true);
    $("#stopBtn").prop("disabled", false);
    $("#replayStatus").text("Playing " + replaySpeed + "×");

    if (replayTimer) clearInterval(replayTimer);
    replayTimer = setInterval(function () {
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
    $("#replayStatus").text("Paused");
  }

  /* ===== Stopwatch ===== */
  function setStopwatchMs(msSinceStart) {
    if (msSinceStart < 0) msSinceStart = 0;

    var totalSeconds = Math.floor(msSinceStart / 1000);
    var hh = Math.floor(totalSeconds / 3600);
    var mm = Math.floor((totalSeconds % 3600) / 60);
    var ss = totalSeconds % 60;

    $("#stopwatch").text(
      F1Utils.pad2(hh) + ":" + F1Utils.pad2(mm) + ":" + F1Utils.pad2(ss)
    );
  }

  /* ===== Replay tick ===== */
  function warmCaches(done) {
    var sk = state.session_key;
    $.when(
      F1Utils.safeAjax(OpenF1API.drivers({ session_key: sk }), "drivers"),
      F1Utils.safeAjax(OpenF1API.stints({ session_key: sk }),  "stints"),
      F1Utils.safeAjax(OpenF1API.pit({ session_key: sk }),     "pit")
    ).done(function (drv, st, pit) {
      cache.driversRaw = drv || [];
      cache.stints     = st  || [];
      cache.pits       = pit || [];
      lastSlowMs = Date.now();
      done && done();
    });
  }

  function tickReplay(isInitial) {
    if (!state.session_key) return;
    if (F1Utils.isBackingOff()) return;

    // Refresh slow caches every 30s during replay
    if (!isInitial && Date.now() - lastSlowMs > 30000) {
      warmCaches();
    }

    var sk   = state.session_key;
    var tIso = new Date(replayClockMs).toISOString();

    if (state.session_start) {
      setStopwatchMs(replayClockMs - Date.parse(state.session_start));
    }

    var fromIso = new Date(replayClockMs - 1500).toISOString();

    $.when(
      F1Utils.safeAjax(OpenF1API.position({ session_key: sk, date: "<=" + tIso }),           "position"),
      F1Utils.safeAjax(OpenF1API.intervals({ session_key: sk, date: "<=" + tIso }),           "intervals"),
      F1Utils.safeAjax(OpenF1API.carData({ session_key: sk, date: ">=" + fromIso }),          "car_data"),
      F1Utils.safeAjax(OpenF1API.laps({ session_key: sk, date_start: "<=" + tIso }),          "laps"),
      F1Utils.safeAjax(OpenF1API.location({ session_key: sk, date: ">=" + fromIso }),         "location")
    ).done(function (pos, ints, car, laps, locs) {

      var rows = TowerData.build({
        positions: pos || [],
        intervals: ints || [],
        stints:    cache.stints || [],
        pits:      cache.pits   || [],
        laps:      laps || [],
        drivers:   F1Data.normalizeDrivers(cache.driversRaw || []),
        carData:   car || []
      });

      TowerUI.render(rows);

      // Track map
      if (typeof TrackMap !== "undefined" && Array.isArray(locs) && locs.length) {
        var colorMap = {};
        F1Data.normalizeDrivers(cache.driversRaw || []).forEach(function (d) {
          colorMap[d.number] = d.teamColour || null;
        });
        TrackMap.update(locs, colorMap);
      }
    });
  }

  /* ===== Scrubber ===== */
  function initScrubber() {
    var $scrubber = $("#replayScrubber");
    if (!$scrubber.length) return;

    $scrubber.on("input", function () {
      var pct = Number($scrubber.val()) / 100;
      if (!state.session_start) return;
      // Assume typical race is ~2 hours (7200s)
      var sessionDurationMs = 7200000;
      replayClockMs = Date.parse(state.session_start) + pct * sessionDurationMs;
      setStopwatchMs(replayClockMs - Date.parse(state.session_start));
    });

    $scrubber.on("change", function () {
      // Re-warm caches when jumping
      warmCaches(function () { tickReplay(true); });
    });
  }

  /* ===== Utils ===== */
  function getMeetingKeyFromUrl() {
    var p  = new URLSearchParams(window.location.search);
    var mk = Number(p.get("meeting_key"));
    return mk || null;
  }

  function showError(msg) {
    var $err = $("<div>").addClass("dash-msg error-msg").text(msg);
    $("main").prepend($err);
  }

  return { init: init };
})();

$(document).ready(function () {
  RacePage.init();
});
