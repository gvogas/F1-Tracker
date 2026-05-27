var RacePage = (function () {

  var state = {
    meeting_key:   null,
    session_key:   null,
    session_start: null, // ISO string
    driverInfo:    {}     // number -> { color, acronym, position }, fed to the track map
  };

  var mode          = "stopped";
  var replayTimer   = null;
  var replayClockMs = 0;
  var replaySpeed   = 5; // 5× default
  var replayInFlight = false;
  var mapInFlight    = false;

  /* ===== Init ===== */
  function init() {
    if (typeof HeaderModel !== "undefined") HeaderModel.createHeader();
    if (typeof TrackMap !== "undefined") TrackMap.init("trackMap");

    state.meeting_key = getMeetingKeyFromUrl();
    if (!state.meeting_key) {
      showError("No meeting selected. Please go to Races and pick a session.");
      return;
    }

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
    $("#sessionSelect").append('<option value="">Loading sessions…</option>');

    F1API.sessions({ meeting_key: meetingKey })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        if (!sessions.length) {
          $("#sessionSelect").empty()
            .append('<option value="">No sessions found</option>')
            .prop("disabled", false);
          showError("No sessions found for this meeting.");
          return;
        }

        sessions.sort(function (a, b) {
          return Date.parse(a.dateStart) - Date.parse(b.dateStart);
        });

        $("#sessionSelect").empty();
        $("#sessionSelect").append('<option value="">— Select session —</option>');

        for (var i = 0; i < sessions.length; i++) {
          var s     = sessions[i]; // PHP camelCase: s.key, s.name, s.dateStart
          var label = s.name || ("Session " + s.key);
          var d     = s.dateStart ? new Date(s.dateStart) : null;
          if (d && !isNaN(d)) {
            label += " · " + d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          }
          $("#sessionSelect").append(
            $("<option>")
              .val(s.key)
              .attr("data-start", s.dateStart || "")
              .text(label)
          );
        }

        var best = F1Data.pickBestSession(sessions);
        state.session_key   = best ? best.key : null;
        state.session_start = (best && best.dateStart) ? best.dateStart : null;

        if (state.session_key) {
          $("#sessionSelect").val(String(state.session_key));
        }
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
    if (typeof TrackMap !== "undefined") TrackMap.clear();
    state.driverInfo = {};
    $("#mapStatus").text("");
    if (!state.session_key) return;

    var $opt = $("#sessionSelect option:selected");
    state.session_start = $opt.attr("data-start") || state.session_start;

    WeatherData.getLatestForSession(state.session_key)
      .then(function (w) { WeatherData.renderToDashboard(w); })
      .catch(function () {});

    replayClockMs = state.session_start ? Date.parse(state.session_start) : Date.now();
    setStopwatch(0);
    seedMap();
    tickReplay(true);

    loadAiStrategy(state.session_key);
  }

  /* ===== Track map ===== */
  // number -> { color, acronym, position } for the track-map dots
  function buildDriverInfo(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r.driverNumber) return;
      var d = r.driver || {};
      map[r.driverNumber] = {
        color:    d.teamColour || null,
        acronym:  d.acronym || "",
        position: r.position || 0
      };
    });
    return map;
  }

  // One-time circuit outline anchored at the session start (server caches ~1h).
  function seedMap() {
    if (typeof TrackMap === "undefined" || !state.session_key) return;
    var params = { session_key: state.session_key };
    if (state.session_start) params.date = state.session_start;
    F1API.trackOutline(params)
      .done(function (points) {
        if (Array.isArray(points) && points.length) TrackMap.seedTrack(points);
      });
  }

  function updateMap(tIso) {
    if (typeof TrackMap === "undefined" || !state.session_key || mapInFlight ||
        !F1Utils.isVisible("trackMap")) return;
    var sk = state.session_key;
    mapInFlight = true;
    F1API.location({ session_key: sk, date: tIso })
      .done(function (rows) {
        if (state.session_key !== sk) return; // session changed mid-flight
        rows = Array.isArray(rows) ? rows : [];
        TrackMap.update(rows, state.driverInfo);

        var seen = {};
        for (var i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].driver_number) seen[rows[i].driver_number] = true;
        }
        var n = Object.keys(seen).length;
        $("#mapStatus").text(n ? (n + " cars") : "");
      })
      .always(function () { mapInFlight = false; });
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
    $("#stopwatch").text(F1Utils.pad2(hh) + ":" + F1Utils.pad2(mm) + ":" + F1Utils.pad2(ss));
  }

  function tickReplay(isInitial) {
    if (!state.session_key) return;

    if (state.session_start) {
      setStopwatch(replayClockMs - Date.parse(state.session_start));
    }

    // Don't stack requests if the backend is slower than the replay tick.
    if (replayInFlight) return;

    var tIso = new Date(replayClockMs).toISOString();
    var sk   = state.session_key;

    replayInFlight = true;
    F1API.tower({ session_key: sk, date: tIso })
      .done(function (rows) {
        if (state.session_key !== sk) return; // session changed mid-flight
        TowerUI.render(TowerAdapter.adaptRows(rows));
        state.driverInfo = buildDriverInfo(rows);
      })
      .fail(function (xhr) {
        if (!isInitial) console.warn("replay tick failed", xhr && xhr.status);
      })
      .always(function () { replayInFlight = false; });

    // Track map reflects the same replay timestamp (own guard so a slow
    // request never stacks at high replay speed).
    updateMap(tIso);
  }

  /* ===== AI Strategy ===== */
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

  function showError(msg) {
    var $err = $("<div>").addClass("dash-msg error-msg").text(msg);
    $("main").prepend($err);
  }

  return { init: init };
})();

$(document).ready(function () { RacePage.init(); });
