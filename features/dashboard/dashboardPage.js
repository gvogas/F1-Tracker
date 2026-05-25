var DashboardPageModel = (function () {

  var state = {
    year:        new Date().getFullYear(),
    meeting_key: null,
    session_key: null
  };

  /* ===== Weather auto-refresh ===== */
  var weatherTimer = null;

  function startWeatherRefresh() {
    stopWeatherRefresh();
    weatherTimer = setInterval(function () {
      if (state.session_key && !document.hidden) loadWeather(state.session_key);
    }, 60000);
  }

  function stopWeatherRefresh() {
    clearInterval(weatherTimer);
    weatherTimer = null;
  }

  /* ===== Live tower polling ===== */
  var towerTimer    = null;
  var towerInFlight = false;

  function startTower() {
    stopTower();
    tickTower();
    towerTimer = setInterval(tickTower, 5000);
    setLiveIndicator(true);
  }

  function stopTower() {
    clearInterval(towerTimer);
    towerTimer = null;
    towerInFlight = false;
    setLiveIndicator(false);
    $("#tower").empty();
    if (typeof TrackMap !== "undefined") TrackMap.clear();
  }

  function tickTower() {
    // Skip while the tab is backgrounded or a request is already in flight —
    // avoids piling up overlapping requests and hammering the API.
    if (!state.session_key || document.hidden || towerInFlight) return;

    towerInFlight = true;
    F1API.tower({ session_key: state.session_key })
      .done(function (rows) {
        TowerUI.render(TowerAdapter.adaptRows(rows));

        var now = new Date();
        var ts = F1Utils.pad2(now.getHours()) + ":" + F1Utils.pad2(now.getMinutes()) + ":" + F1Utils.pad2(now.getSeconds());
        $("#lastUpdated").text("Updated " + ts);
      })
      .fail(function (xhr) {
        if (xhr.status !== 429) console.warn("tower tick failed", xhr.status);
      })
      .always(function () { towerInFlight = false; });
  }

  /* ===== Live indicator ===== */
  function setLiveIndicator(active) {
    var $el = $("#liveIndicator");
    if (active) {
      $el.addClass("is-live").text("● LIVE");
    } else {
      $el.removeClass("is-live").text("IDLE");
    }
  }

  /* ===== AI cards ===== */
  var aiCommentaryTimer = null;
  var aiPredTimer       = null;

  function startAiRefresh() {
    stopAiRefresh();

    // Goal 6: commentary every 30s (silent refresh — no spinner flash)
    aiCommentaryTimer = setInterval(function () {
      if (state.session_key && !document.hidden) loadAiCommentary(state.session_key, false);
    }, 30000);

    // Goal 9: prediction every 60s (silent refresh)
    aiPredTimer = setInterval(function () {
      if (state.session_key && !document.hidden) loadAiPrediction(state.session_key, false);
    }, 60000);

    // Load immediately on session start (with loading state)
    if (state.session_key) loadAllAi(state.session_key);
  }

  function stopAiRefresh() {
    clearInterval(aiCommentaryTimer);
    clearInterval(aiPredTimer);
    aiCommentaryTimer = null;
    aiPredTimer       = null;
  }

  function loadAllAi(sessionKey) {
    loadAiCommentary(sessionKey, true);
    loadAiPrediction(sessionKey, true);
    loadAiRaceControl(sessionKey, true);
    loadAiStrategy(sessionKey, true);
  }

  /* ===== AI card state rendering ===== */
  function aiLoading(sel, msg) {
    $(sel).html('<span class="ai-state"><span class="spinner"></span> ' +
      F1Utils.escapeHtml(msg || "Generating…") + '</span>');
  }
  function aiContent(sel, text) {
    $(sel).html($('<p class="muted">').css({ margin: 0, lineHeight: 1.6 }).text(text));
  }
  function aiEmpty(sel, msg) {
    $(sel).html('<span class="ai-state">' + F1Utils.escapeHtml(msg) + '</span>');
  }
  function aiError(sel, retryFn) {
    var $box = $('<span class="ai-state is-error">').text("⚠ Couldn't load this right now. ");
    $box.append($('<button class="retry-btn" type="button">').text("Retry").on("click", retryFn));
    $(sel).empty().append($box);
  }

  // showLoading=true on first load / manual retry; false for silent interval refresh.
  function loadAiCommentary(sessionKey, showLoading) {
    if (showLoading) aiLoading("#aiCommentaryText", "Generating commentary…");
    F1API.aiCommentator(sessionKey)
      .done(function (res) {
        if (res && res.commentary) aiContent("#aiCommentaryText", res.commentary);
        else if (showLoading)      aiEmpty("#aiCommentaryText", "No commentary yet — waiting for on-track action.");
      })
      .fail(function () {
        if (showLoading) aiError("#aiCommentaryText", function () { loadAiCommentary(state.session_key, true); });
      });
  }

  function loadAiRaceControl(sessionKey, showLoading) {
    if (showLoading) aiLoading("#aiRCText", "Summarising stewards' messages…");
    F1API.aiRaceControlExplain(sessionKey)
      .done(function (res) {
        if (res && res.explanation) aiContent("#aiRCText", res.explanation);
        else if (showLoading)       aiEmpty("#aiRCText", "No race control messages yet.");
      })
      .fail(function () {
        if (showLoading) aiError("#aiRCText", function () { loadAiRaceControl(state.session_key, true); });
      });
  }

  function loadAiPrediction(sessionKey, showLoading) {
    if (showLoading) aiLoading("#aiPredText", "Predicting the finish…");
    F1API.aiPerformance(sessionKey)
      .done(function (res) {
        if (res && res.prediction) aiContent("#aiPredText", res.prediction);
        else if (showLoading)      aiEmpty("#aiPredText", "Not enough data to predict yet.");
      })
      .fail(function () {
        if (showLoading) aiError("#aiPredText", function () { loadAiPrediction(state.session_key, true); });
      });
  }

  function loadAiStrategy(sessionKey, showLoading) {
    if (showLoading) aiLoading("#aiStrategyText", "Analysing tyre strategy…");
    F1API.aiTyreStrategy(sessionKey)
      .done(function (res) {
        if (res && res.analysis) aiContent("#aiStrategyText", res.analysis);
        else if (showLoading)    aiEmpty("#aiStrategyText", "No strategy data yet.");
      })
      .fail(function () {
        if (showLoading) aiError("#aiStrategyText", function () { loadAiStrategy(state.session_key, true); });
      });
  }

  /* ===== AI tab switching ===== */
  function initAiTabs() {
    $(document).on("click", ".ai-tab", function () {
      var tabId = $(this).attr("data-tab");
      if (!tabId || !/^[\w-]+$/.test(tabId)) return;
      $(".ai-tab").removeClass("is-active");
      $(this).addClass("is-active");
      $(".ai-content").hide();
      $("#" + tabId).show();
    });

    $("#aiRefreshBtn").on("click", function () {
      if (state.session_key) loadAllAi(state.session_key);
    });
  }

  /* ===== Weather ===== */
  function loadWeather(sessionKey) {
    WeatherData.getLatestForSession(sessionKey)
      .then(function (w) { WeatherData.renderToDashboard(w); })
      .catch(function ()  { console.warn("Weather load failed"); });
  }

  /* ===== Init ===== */
  function init() {
    if (typeof HeaderModel !== "undefined") HeaderModel.createHeader();

    if (typeof TrackMap !== "undefined") {
      TrackMap.init("trackMap");
    }

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

    // When the tab comes back to the foreground, refresh right away instead of
    // waiting for the next interval tick.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.session_key) {
        tickTower();
        loadWeather(state.session_key);
      }
    });

    initAiTabs();
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
        if (!meetings.length) {
          $("#meetingSelect").prop("disabled", false);
          return;
        }

        $("#meetingSelect").append('<option value="">Select race</option>');
        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i]; // PHP camelCase: m.key, m.name, m.dateStart
          $("#meetingSelect").append($("<option>").val(m.key).text(F1Utils.formatMeetingLabel(m)));
        }

        var latest = F1Data.pickLatestStarted(meetings);
        var picked = (force || !state.meeting_key)
          ? (latest ? latest.key : null)
          : state.meeting_key;

        if (!picked) picked = meetings[meetings.length - 1].key;

        state.meeting_key = picked;
        $("#meetingSelect").val(String(picked)).prop("disabled", false);
        loadSessionsForMeeting(picked, false);
      })
      .fail(function () { $("#meetingSelect").prop("disabled", false); });
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
        if (!sessions.length) {
          $("#sessionSelect").prop("disabled", false);
          return;
        }

        $("#sessionSelect").append('<option value="">Select session</option>');
        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i]; // PHP camelCase: s.key, s.name, s.dateStart
          $("#sessionSelect").append($("<option>").val(s.key).text(F1Utils.formatSessionLabel(s)));
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
