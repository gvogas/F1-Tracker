var RacePage = (function () {

  var state = {
    meeting_key:   null,
    session_key:   null,
    session_start: null
  };

  var mode         = "stopped";
  var replayTimer  = null;
  var replayClockMs = 0;
  var replaySpeed  = 5; // 5x

  function init() {
    state.meeting_key = getMeetingKeyFromUrl();
    if (!state.meeting_key) {
      console.error("Missing meeting_key in URL");
      return;
    }

    if (typeof HeaderModel !== "undefined") HeaderModel.createHeader();

    $("#playBtn").on("click",  startReplay);
    $("#stopBtn").on("click",  stopReplay);

    $("#sessionSelect").on("change", function () {
      state.session_key = Number($("#sessionSelect").val()) || null;
      onSessionChanged();
    });

    loadSessions(state.meeting_key);
  }

  /* ===== Sessions ===== */
  function loadSessions(meetingKey) {
    $("#sessionSelect").prop("disabled", true).empty();
    $("#sessionSelect").append('<option value="">Select session</option>');

    F1API.sessions({ meeting_key: meetingKey })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        for (var i = 0; i < sessions.length; i++) {
          var s     = sessions[i]; // s.key, s.name, s.dateStart
          var label = s.name || ("Session " + s.key);
          $("#sessionSelect").append(
            $("<option>")
              .val(s.key)
              .attr("data-start", s.dateStart || "")
              .text(esc(label))
          );
        }

        var best = F1Data.pickBestSession(sessions);
        state.session_key   = best.key;
        state.session_start = best.dateStart || null;

        $("#sessionSelect").val(String(state.session_key)).prop("disabled", false);
        onSessionChanged();
      })
      .fail(function (xhr) {
        console.error("sessions failed", xhr);
        $("#sessionSelect").prop("disabled", false);
      });
  }

  function onSessionChanged() {
    stopReplay();
    if (!state.session_key) return;

    var $opt = $("#sessionSelect option:selected");
    state.session_start = $opt.attr("data-start") || state.session_start;

    WeatherData.getLatestForSession(state.session_key)
      .then(function (w) { WeatherData.renderToDashboard(w); })
      .catch(function () {});

    replayClockMs = state.session_start ? Date.parse(state.session_start) : Date.now();
    setStopwatch(0);
    tickReplay(true);

    // Load AI strategy card once session is selected
    loadAiStrategy(state.session_key);
  }

  /* ===== Replay ===== */
  function startReplay() {
    if (!state.session_key) return;
    mode = "playing";
    $("#playBtn").prop("disabled", true);
    $("#stopBtn").prop("disabled", false).show();
    clearInterval(replayTimer);
    replayTimer = setInterval(function () {
      replayClockMs += replaySpeed * 1000;
      tickReplay(false);
    }, 1000);
  }

  function stopReplay() {
    mode = "stopped";
    clearInterval(replayTimer);
    replayTimer = null;
    $("#playBtn").prop("disabled", false);
    $("#stopBtn").prop("disabled", true).hide();
  }

  function setStopwatch(msSinceStart) {
    msSinceStart = Math.max(0, msSinceStart);
    var total = Math.floor(msSinceStart / 1000);
    var hh = Math.floor(total / 3600);
    var mm = Math.floor((total % 3600) / 60);
    var ss = total % 60;
    $("#stopwatch").text(pad(hh) + ":" + pad(mm) + ":" + pad(ss));
  }

  function tickReplay(isInitial) {
    if (!state.session_key) return;

    if (state.session_start) {
      setStopwatch(replayClockMs - Date.parse(state.session_start));
    }

    var tIso = new Date(replayClockMs).toISOString();

    F1API.tower({ session_key: state.session_key, date: tIso })
      .done(function (rows) {
        TowerUI.render(adaptRows(rows));
      })
      .fail(function (xhr) {
        if (!isInitial) console.warn("replay tick failed", xhr && xhr.status);
      });
  }

  // Convert PHP tower rows → TowerUI format
  function adaptRows(rows) {
    return (rows || []).map(function (r) {
      var driver   = r.driver || {};
      var compound = String(r.compound || "");
      var tyreClass = compound === "S" ? "soft"
                    : compound === "M" ? "med"
                    : compound === "H" ? "hard" : "";
      var drs      = Number(r.drs || 0);
      var drsState = (drs === 10 || drs === 12 || drs === 14) ? "on"
                   : drs === 8 ? "eligible" : "off";
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

  /* ===== AI ===== */
  function loadAiStrategy(sessionKey) {
    F1API.aiTyreStrategy(sessionKey)
      .done(function (res) {
        if (res && res.analysis) {
          $("#aiStrategyText").text(res.analysis);
          $("#aiStrategyCard").show();
        }
      });
  }

  /* ===== Helpers ===== */
  function getMeetingKeyFromUrl() {
    var p  = new URLSearchParams(window.location.search);
    var mk = Number(p.get("meeting_key"));
    return mk || null;
  }

  function pad(n) {
    return (Number(n) < 10 ? "0" : "") + Number(n);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return { init: init };
})();

$(document).ready(function () { RacePage.init(); });
