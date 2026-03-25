var DashboardPageModel = (function () {

  var state = {
    year:        new Date().getFullYear(),
    meeting_key: null,
    session_key: null
  };

  // ===== Weather refresh =====
  var weatherTimer = null;

  function startWeatherRefresh() {
    stopWeatherRefresh();
    weatherTimer = setInterval(function () {
      if (state.session_key) loadWeather(state.session_key);
    }, 60000);
  }

  function stopWeatherRefresh() {
    clearInterval(weatherTimer);
    weatherTimer = null;
  }

  // ===== Tower polling =====
  var towerTimer   = null;

  function startTower() {
    stopTower();
    tickTower();
    towerTimer = setInterval(tickTower, 2500);
  }

  function stopTower() {
    clearInterval(towerTimer);
    towerTimer = null;
    $("#tower").empty();
  }

  function tickTower() {
    if (!state.session_key) return;
    F1API.tower({ session_key: state.session_key })
      .done(function (rows) {
        TowerUI.render(adaptRows(rows));
      })
      .fail(function (xhr) {
        if (xhr.status !== 429) console.warn("tower tick failed", xhr.status);
      });
  }

  // Convert PHP tower rows to TowerUI format
  function adaptRows(rows) {
    return (rows || []).map(function (r) {
      var driver   = r.driver || {};
      var compound = String(r.compound || "");
      var tyreClass = compound === "S" ? "soft"
                    : compound === "M" ? "med"
                    : compound === "H" ? "hard" : "";
      var drs      = Number(r.drs || 0);
      var drsState = (drs === 10 || drs === 12 || drs === 14) ? "on"
                   : (drs === 8) ? "eligible" : "off";
      var s1 = Number(r.sector1 || 0);
      var s2 = Number(r.sector2 || 0);
      var s3 = Number(r.sector3 || 0);
      var tot = s1 + s2 + s3;

      return {
        driverNumber: r.driverNumber,
        position:     r.position,
        code:         driver.acronym || ("#" + r.driverNumber),
        drsState:     drsState,
        tyreClass:    tyreClass,
        tyreLetter:   compound || "-",
        lap:          r.lapNumber,
        pits:         r.pitCount,
        gap:          r.gap,
        interval:     r.interval,
        lastLap:      r.lastLap,
        bestLap:      "—",
        s1p:          tot > 0 ? (s1 / tot * 100) : 0,
        s2p:          tot > 0 ? (s2 / tot * 100) : 0,
        s3p:          tot > 0 ? (s3 / tot * 100) : 0,
      };
    });
  }

  // ===== AI cards =====
  var aiCommentaryTimer = null;
  var aiPredTimer       = null;

  function startAiRefresh() {
    stopAiRefresh();

    // Goal 6: commentary every 30s
    aiCommentaryTimer = setInterval(function () {
      if (state.session_key) loadAiCommentary(state.session_key);
    }, 30000);

    // Goal 9: prediction every 60s
    aiPredTimer = setInterval(function () {
      if (state.session_key) loadAiPrediction(state.session_key);
    }, 60000);

    // Load once on start
    if (state.session_key) {
      loadAiCommentary(state.session_key);
      loadAiPrediction(state.session_key);
      loadAiRaceControl(state.session_key);
      loadAiStrategy(state.session_key);
    }
  }

  function stopAiRefresh() {
    clearInterval(aiCommentaryTimer);
    clearInterval(aiPredTimer);
    aiCommentaryTimer = null;
    aiPredTimer       = null;
  }

  function loadAiCommentary(sessionKey) {
    F1API.aiCommentator(sessionKey)
      .done(function (res) {
        if (res && res.commentary) {
          $("#aiCommentaryText").text(res.commentary);
          $("#aiCommentaryCard").show();
        }
      });
  }

  function loadAiRaceControl(sessionKey) {
    F1API.aiRaceControlExplain(sessionKey)
      .done(function (res) {
        if (res && res.explanation) {
          $("#aiRCText").text(res.explanation);
          $("#aiRCCard").show();
        }
      });
  }

  function loadAiPrediction(sessionKey) {
    F1API.aiPerformance(sessionKey)
      .done(function (res) {
        if (res && res.prediction) {
          $("#aiPredText").text(res.prediction);
          $("#aiPredCard").show();
        }
      });
  }

  function loadAiStrategy(sessionKey) {
    F1API.aiTyreStrategy(sessionKey)
      .done(function (res) {
        if (res && res.analysis) {
          $("#aiStrategyText").text(res.analysis);
          $("#aiStrategyCard").show();
        }
      });
  }

  // ===== Weather =====
  function loadWeather(sessionKey) {
    WeatherData.getLatestForSession(sessionKey)
      .then(function (w) { WeatherData.renderToDashboard(w); })
      .catch(function ()  { /* silent */ });
  }

  // ===== Init =====
  function init() {
    HeaderModel.createHeader();

    $("#refreshBtn").on("click", function () { loadMeetings(true); });

    $("#meetingSelect").on("change", function () {
      state.meeting_key = Number($("#meetingSelect").val()) || null;
      state.session_key = null;
      stopTower();
      stopAiRefresh();
      loadSessionsForMeeting(state.meeting_key, true);
    });

    $("#sessionSelect").on("change", function () {
      state.session_key = Number($("#sessionSelect").val()) || null;
      stopTower();
      stopAiRefresh();
      if (state.session_key) {
        loadWeather(state.session_key);
        startTower();
        startAiRefresh();
      }
    });

    loadMeetings(false);
    startWeatherRefresh();
  }

  /* ===== Meetings ===== */
  function loadMeetings(force) {
    $("#meetingSelect").prop("disabled", true).empty();
    $("#sessionSelect").prop("disabled", true).empty();
    stopTower();
    stopAiRefresh();

    F1API.meetings({ year: state.year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        if (!meetings.length) return;

        $("#meetingSelect").append('<option value="">Select race</option>');
        for (var i = 0; i < meetings.length; i++) {
          var m     = meetings[i];
          var label = m.name || m.officialName || ("Meeting " + m.key);
          $("#meetingSelect").append(
            $("<option>").val(m.key).text(label)
          );
        }

        var picked = (force || !state.meeting_key)
          ? pickLatestStarted(meetings)
          : state.meeting_key;

        if (!picked) picked = meetings[meetings.length - 1].key;

        state.meeting_key = picked;
        $("#meetingSelect").val(String(picked)).prop("disabled", false);
        loadSessionsForMeeting(picked, false);
      })
      .fail(function () { $("#meetingSelect").prop("disabled", false); });
  }

  function pickLatestStarted(meetings) {
    var now     = Date.now();
    var started = meetings.filter(function (m) {
      var t = Date.parse(m.dateStart);
      return !isNaN(t) && t <= now;
    });
    if (!started.length) return null;
    return started[started.length - 1].key;
  }

  /* ===== Sessions ===== */
  function loadSessionsForMeeting(meetingKey, forcePick) {
    $("#sessionSelect").prop("disabled", true).empty();
    if (!meetingKey) {
      $("#sessionSelect").append('<option value="">Select session</option>').prop("disabled", false);
      return;
    }

    F1API.sessions({ meeting_key: meetingKey })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        if (!sessions.length) return;

        $("#sessionSelect").append('<option value="">Select session</option>');
        for (var i = 0; i < sessions.length; i++) {
          var s     = sessions[i];
          var label = s.name || ("Session " + s.key);
          $("#sessionSelect").append($("<option>").val(s.key).text(label));
        }

        var picked = (forcePick || !state.session_key)
          ? F1Data.pickBestSession(sessions).key
          : state.session_key;

        state.session_key = picked;
        $("#sessionSelect").val(String(picked)).prop("disabled", false);

        stopTower();
        stopAiRefresh();
        loadWeather(state.session_key);
        startTower();
        startAiRefresh();
      })
      .fail(function () { $("#sessionSelect").prop("disabled", false); });
  }

  return { init: init };
})();

$(document).ready(function () {
  DashboardPageModel.init();
});
