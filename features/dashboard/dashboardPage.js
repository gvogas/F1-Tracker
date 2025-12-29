var DashboardPageModel = (function () {

  var state = {
    year: new Date().getFullYear(),
    meeting_key: null,
    session_key: null
  };

  // ===== Weather auto-refresh =====
  var weatherTimer = null;

  function startWeatherAutoRefresh() {
    stopWeatherAutoRefresh();
    weatherTimer = setInterval(function () {
      if (state.session_key) loadWeatherForSession(state.session_key);
    }, 60000);
  }

  function stopWeatherAutoRefresh() {
    if (weatherTimer) clearInterval(weatherTimer);
    weatherTimer = null;
  }

  // ===== Tower polling + caching =====
  var towerTimer = null;

  // caches (so we don't refetch huge stuff every tick)
  var cache = {
    driversRaw: [],
    stints: [],
    pits: [],
    laps: [],
    carData: []
  };

  // time windows / intervals
  var carSince = null;

  var lastCar = 0;      // 2.5s
  var lastLaps = 0;     // 5s
  var lastSlow = 0;     // 10s

  // backoff when API says 429
  var backoffUntil = 0;

  function startTower() {
    stopTower();
    tickTower();
    towerTimer = setInterval(tickTower, 1000);
  }

  function stopTower() {
    if (towerTimer) clearInterval(towerTimer);
    towerTimer = null;
  }

  function resetTowerState() {
    cache.driversRaw = [];
    cache.stints = [];
    cache.pits = [];
    cache.laps = [];
    cache.carData = [];

    carSince = null;

    lastCar = 0;
    lastLaps = 0;
    lastSlow = 0;

    backoffUntil = 0;

    $("#tower").empty();
  }

  function tickReplay(isInitial) {
  if (!state.session_key) return;

  if (!isInitial && Date.now() - lastSlowMs > 30000) warmCaches();

  var sk = state.session_key;
  var tIso = new Date(replayClockMs).toISOString();

  if (state.session_start) {
    setStopwatchMs(replayClockMs - Date.parse(state.session_start));
  }

  // Smaller window to reduce 422/429 risk
  var fromIso = new Date(replayClockMs - 2000).toISOString(); // last 2s

  $.when(
    safeAjax(OpenF1API.position({ session_key: sk, date: "<=" + tIso }), "position"),
    safeAjax(OpenF1API.intervals({ session_key: sk, date: "<=" + tIso }), "intervals"),
    safeAjax(OpenF1API.carData({ session_key: sk, date: ">=" + fromIso }), "car_data"),
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

  function init() {
    HeaderModel.createHeader();

    $("#refreshBtn").on("click", function () {
      loadMeetings(true);
    });

    $("#meetingSelect").on("change", function () {
      state.meeting_key = Number($("#meetingSelect").val()) || null;
      state.session_key = null;

      stopTower();
      resetTowerState();

      loadSessionsForMeeting(state.meeting_key, true);
    });

    $("#sessionSelect").on("change", function () {
      state.session_key = Number($("#sessionSelect").val()) || null;

      stopTower();
      resetTowerState();

      if (state.session_key) {
        loadWeatherForSession(state.session_key);
        startTower();
      }
    });

    loadMeetings(false);
    startWeatherAutoRefresh();
  }

  /* =========================
     Meetings
  ========================= */
  function loadMeetings(force) {
    $("#meetingSelect").prop("disabled", true).empty();
    $("#sessionSelect").prop("disabled", true).empty();

    stopTower();
    resetTowerState();

    OpenF1API.meetings({ year: state.year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        if (!meetings.length) throw new Error("No meetings found");

        meetings.sort(function (a, b) {
          return Date.parse(a.date_start) - Date.parse(b.date_start);
        });

        $("#meetingSelect").append('<option value="">Select race</option>');

        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i];
          var label = (m.meeting_name || m.meeting_official_name || ("Meeting " + m.meeting_key));
          $("#meetingSelect").append(
            '<option value="' + m.meeting_key + '">' + escapeHtml(label) + '</option>'
          );
        }

        var picked = state.meeting_key;
        if (force || !picked) {
          picked = pickLatestStartedMeetingKey(meetings) || meetings[meetings.length - 1].meeting_key;
        }

        state.meeting_key = picked;
        $("#meetingSelect").val(String(picked));
        $("#meetingSelect").prop("disabled", false);

        loadSessionsForMeeting(state.meeting_key, false);
      })
      .fail(function (xhr) {
        console.error("meetings failed", xhr);
      })
      .always(function () {
        $("#meetingSelect").prop("disabled", false);
      });
  }

  function pickLatestStartedMeetingKey(meetings) {
    var now = Date.now();
    var started = meetings.filter(function (m) {
      var t = Date.parse(m.date_start);
      return !isNaN(t) && t <= now;
    });
    if (!started.length) return null;

    started.sort(function (a, b) {
      return Date.parse(a.date_start) - Date.parse(b.date_start);
    });
    return started[started.length - 1].meeting_key;
  }

  /* =========================
     Sessions
  ========================= */
  function loadSessionsForMeeting(meeting_key, forcePick) {
    $("#sessionSelect").prop("disabled", true).empty();

    if (!meeting_key) {
      $("#sessionSelect").append('<option value="">Select session</option>');
      $("#sessionSelect").prop("disabled", false);
      return;
    }

    OpenF1API.sessions({ meeting_key: meeting_key })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        if (!sessions.length) throw new Error("No sessions found");

        sessions.sort(function (a, b) {
          return Date.parse(a.date_start) - Date.parse(b.date_start);
        });

        $("#sessionSelect").append('<option value="">Select session</option>');

        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i];
          var label = s.session_name || ("Session " + s.session_key);
          $("#sessionSelect").append(
            '<option value="' + s.session_key + '">' + escapeHtml(label) + '</option>'
          );
        }

        var picked = state.session_key;
        if (forcePick || !picked) {
          var best = F1Data.pickBestSession(sessions);
          picked = best.session_key;
        }

        state.session_key = picked;
        $("#sessionSelect").val(String(picked));
        $("#sessionSelect").prop("disabled", false);

        stopTower();
        resetTowerState();

        loadWeatherForSession(state.session_key);
        startTower();
      })
      .fail(function (xhr) {
        console.error("sessions failed", xhr);
      })
      .always(function () {
        $("#sessionSelect").prop("disabled", false);
      });
  }

  /* =========================
     Weather
  ========================= */
  function loadWeatherForSession(session_key) {
    WeatherData.getLatestForSession(session_key)
      .then(function (w) {
        WeatherData.renderToDashboard(w);
      })
      .catch(function (err) {
        console.error("weather failed", err);
      });
  }

  function escapeHtml(str) {
    str = String(str == null ? "" : str);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return { init: init };
})();

$(document).ready(function () {
  DashboardPageModel.init();
});
