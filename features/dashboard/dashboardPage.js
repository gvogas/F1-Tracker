var DashboardPageModel = (function () {

  var state = {
    year: new Date().getFullYear(),
    meeting_key: null,
    session_key: null
  };

  /* ===== Weather auto-refresh ===== */
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

  /* ===== Live tower polling ===== */
  var towerTimer = null;
  var lastTickMs = 0;

  // caches (slow-changing data — refreshed every 30s)
  var cache = {
    driversRaw: [],
    stints: [],
    pits: []
  };

  var lastSlowMs = 0;

  // 429 backoff tracked globally via F1Utils

  /* ===== safeAjax (local wrapper — delegates to F1Utils) ===== */
  function safeAjax(jqXhr, label) {
    return F1Utils.safeAjax(jqXhr, label);
  }

  /* ===== warmCaches =====
     Load slow-changing data for the current session once,
     then refreshes every 30s during live polling.
  ===== */
  function warmCaches(done) {
    var sk = state.session_key;
    if (!sk) { done && done(); return; }

    $.when(
      safeAjax(OpenF1API.drivers({ session_key: sk }), "drivers"),
      safeAjax(OpenF1API.stints({ session_key: sk }), "stints"),
      safeAjax(OpenF1API.pit({ session_key: sk }), "pit")
    ).done(function (drv, st, pit) {
      cache.driversRaw = drv || [];
      cache.stints = st || [];
      cache.pits = pit || [];
      lastSlowMs = Date.now();
      done && done();
    });

    // Seed track map with historical location data (background, non-blocking)
    if (typeof TrackMap !== "undefined") {
      OpenF1API.location({ session_key: sk })
        .done(function (locs) {
          if (Array.isArray(locs) && locs.length) {
            TrackMap.seedTrack(locs);
          }
        });
    }
  }

  function startTower() {
    stopTower();
    warmCaches(function () {
      tickLive();
      towerTimer = setInterval(tickLive, 1500);
    });
    setLiveIndicator(true);
  }

  function stopTower() {
    if (towerTimer) clearInterval(towerTimer);
    towerTimer = null;
    setLiveIndicator(false);
  }

  function resetTowerState() {
    cache.driversRaw = [];
    cache.stints = [];
    cache.pits = [];
    lastSlowMs = 0;
    $("#tower").empty();
    if (typeof TrackMap !== "undefined") TrackMap.clear();
  }

  /* ===== Live tick ===== */
  function tickLive() {
    if (!state.session_key) return;

    // Skip tick when rate-limited
    if (F1Utils.isBackingOff()) return;

    // Refresh slow caches every 30s
    if (Date.now() - lastSlowMs > 30000) {
      warmCaches();
    }

    var sk = state.session_key;
    var now = new Date();
    var tIso = now.toISOString();
    var fromIso = new Date(Date.now() - 2000).toISOString(); // last 2s for high-freq data

    $.when(
      safeAjax(OpenF1API.position({ session_key: sk, date: "<=" + tIso }), "position"),
      safeAjax(OpenF1API.intervals({ session_key: sk, date: "<=" + tIso }), "intervals"),
      safeAjax(OpenF1API.carData({ session_key: sk, date: ">=" + fromIso }), "car_data"),
      safeAjax(OpenF1API.laps({ session_key: sk, date_start: "<=" + tIso }), "laps"),
      safeAjax(OpenF1API.location({ session_key: sk, date: ">=" + fromIso }), "location")
    ).done(function (pos, ints, car, laps, locs) {
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

      // Update track map with current car positions
      if (typeof TrackMap !== "undefined" && Array.isArray(locs) && locs.length) {
        var driverColorMap = {};
        F1Data.normalizeDrivers(cache.driversRaw || []).forEach(function (d) {
          driverColorMap[d.number] = d.teamColour || null;
        });
        TrackMap.update(locs, driverColorMap);
      }

      // Update "last updated" timestamp
      var now = new Date();
      var ts = F1Utils.pad2(now.getHours()) + ":" + F1Utils.pad2(now.getMinutes()) + ":" + F1Utils.pad2(now.getSeconds());
      $("#lastUpdated").text("Updated " + ts);
    });
  }

  /* ===== Live indicator ===== */
  function setLiveIndicator(active) {
    if (active) {
      $("#liveIndicator").addClass("is-live").text("LIVE");
    } else {
      $("#liveIndicator").removeClass("is-live").text("IDLE");
    }
  }

  /* ===== Init ===== */
  function init() {
    HeaderModel.createHeader();

    if (typeof TrackMap !== "undefined") {
      TrackMap.init("trackMap");
    }

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
    $("#lbMsg").text("Loading meetings...").show();

    stopTower();
    resetTowerState();

    OpenF1API.meetings({ year: state.year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        if (!meetings.length) {
          $("#lbMsg").text("No meetings found for " + state.year + ".").show();
          return;
        }

        meetings.sort(function (a, b) {
          return Date.parse(a.date_start) - Date.parse(b.date_start);
        });

        $("#meetingSelect").append('<option value="">— Select race —</option>');

        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i];
          var label = m.meeting_name || m.meeting_official_name || ("Meeting " + m.meeting_key);
          var d = m.date_start ? new Date(m.date_start) : null;
          if (d && !isNaN(d)) {
            label += " · " + d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
          }
          $("#meetingSelect").append(
            '<option value="' + m.meeting_key + '">' + F1Utils.escapeHtml(label) + '</option>'
          );
        }

        var picked = state.meeting_key;
        if (force || !picked) {
          picked = pickLatestStartedMeetingKey(meetings) || meetings[meetings.length - 1].meeting_key;
        }

        state.meeting_key = picked;
        $("#meetingSelect").val(String(picked));
        $("#meetingSelect").prop("disabled", false);
        $("#lbMsg").text("").hide();

        loadSessionsForMeeting(state.meeting_key, false);
      })
      .fail(function () {
        $("#lbMsg").text("Failed to load meetings. Check your connection.").show();
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
    $("#lbMsg").text("Loading sessions...").show();

    if (!meeting_key) {
      $("#sessionSelect").append('<option value="">— Select session —</option>');
      $("#sessionSelect").prop("disabled", false);
      $("#lbMsg").text("").hide();
      return;
    }

    OpenF1API.sessions({ meeting_key: meeting_key })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        if (!sessions.length) {
          $("#lbMsg").text("No sessions found for this meeting.").show();
          $("#sessionSelect").prop("disabled", false);
          return;
        }

        sessions.sort(function (a, b) {
          return Date.parse(a.date_start) - Date.parse(b.date_start);
        });

        $("#sessionSelect").append('<option value="">— Select session —</option>');

        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i];
          var label = s.session_name || ("Session " + s.session_key);
          var d = s.date_start ? new Date(s.date_start) : null;
          if (d && !isNaN(d)) {
            label += " · " + d.toLocaleDateString(undefined, { weekday: "short" }) + " " +
              d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          }
          $("#sessionSelect").append(
            '<option value="' + s.session_key + '">' + F1Utils.escapeHtml(label) + '</option>'
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
        $("#lbMsg").text("").hide();

        stopTower();
        resetTowerState();

        loadWeatherForSession(state.session_key);
        startTower();
      })
      .fail(function () {
        $("#lbMsg").text("Failed to load sessions. Check your connection.").show();
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
        console.warn("weather failed", err);
      });
  }

  return { init: init };
})();

$(document).ready(function () {
  DashboardPageModel.init();
});
