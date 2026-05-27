var LeaderboardPageModel = (function () {

  var state = {
    year:        new Date().getFullYear(),
    meeting_key: null,
    session_key: null
  };

  function init() {
    if (typeof HeaderModel !== "undefined") HeaderModel.createHeader();

    $("#refreshBtn").on("click", function () { loadMeetings(true); });

    $("#meetingSelect").on("change", function () {
      state.meeting_key = $("#meetingSelect").val() || null;
      state.session_key = null;
      loadSessionsForMeeting(state.meeting_key, true);
    });

    $("#sessionSelect").on("change", function () {
      state.session_key = $("#sessionSelect").val() || null;
      if (state.session_key) loadResults(state.session_key);
    });

    loadMeetings(false);
  }

  /* ===== UI helpers ===== */
  function showMsg(msg) {
    if (msg) {
      $("#lbMsg").text(msg).show();
    } else {
      $("#lbMsg").text("").hide();
    }
  }

  function showSkeleton() {
    $("#driversBody").html(F1Utils.buildSkeleton(5, "row"));
  }

  /* ===== Meetings ===== */
  function loadMeetings(force) {
    showMsg("Loading meetings…");
    showSkeleton();
    $("#lbTitle").text("Leaderboard");

    F1API.meetings({ year: state.year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        if (!meetings.length) {
          showMsg("No meetings found for " + state.year + ".");
          return;
        }

        var prev = (!force && state.meeting_key) ? state.meeting_key : $("#meetingSelect").val();
        $("#meetingSelect").empty();

        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i]; // PHP camelCase: m.key, m.name, m.dateStart
          $("#meetingSelect").append($("<option>").val(String(m.key)).text(F1Utils.formatMeetingLabel(m)));
        }

        var prevStr = prev ? String(prev) : null;
        var pick = (prevStr && $("#meetingSelect option").filter(function () { return this.value === prevStr; }).length)
          ? prevStr
          : String(meetings[meetings.length - 1].key);

        state.meeting_key = pick;
        $("#meetingSelect").val(pick);
        showMsg("");

        loadSessionsForMeeting(pick, force);
      })
      .fail(function () { showMsg("Failed to load meetings. Check your connection."); });
  }

  /* ===== Sessions ===== */
  function loadSessionsForMeeting(meetingKey, force) {
    if (!meetingKey) return;

    showMsg("Loading sessions…");
    showSkeleton();
    $("#sessionSelect").empty();

    F1API.sessions({ meeting_key: meetingKey })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        if (!sessions.length) {
          showMsg("No sessions found for this meeting.");
          return;
        }

        // Update title from last session
        var last = sessions[sessions.length - 1];
        var titleBits = [];
        if (last.location) titleBits.push(last.location);
        if (last.year)     titleBits.push(String(last.year));
        $("#lbTitle").text(titleBits.length ? "Leaderboard · " + titleBits.join(" ") : "Leaderboard");

        var prev = (!force && state.session_key) ? state.session_key : null;

        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i]; // PHP camelCase: s.key, s.name, s.dateStart
          $("#sessionSelect").append($("<option>").val(String(s.key)).text(F1Utils.formatSessionLabel(s)));
        }

        var prevStr = prev ? String(prev) : null;
        var pick = (prevStr && $("#sessionSelect option").filter(function () { return this.value === prevStr; }).length)
          ? prevStr
          : String(F1Data.pickBestSession(sessions).key);

        state.session_key = pick;
        $("#sessionSelect").val(pick);
        showMsg("");
        loadResults(pick);
      })
      .fail(function () { showMsg("Failed to load sessions. Check your connection."); });
  }

  /* ===== Results ===== */
  function loadResults(sessionKey) {
    showMsg("Loading results…");
    showSkeleton();

    F1API.results({ session_key: sessionKey })
      .done(function (results) {
        results = Array.isArray(results) ? results : [];
        render(results);
        showMsg(results.length ? "" : "No results found for this session.");
      })
      .fail(function () { showMsg("Failed to load results. Check your connection."); });
  }

  /* ===== Render ===== */
  function render(results) {
    var prefs     = UserPrefsModel.load();
    var favDriver = (prefs.favoriteDriver || "").trim().toLowerCase();
    var favTeam   = (prefs.favoriteTeam   || "").trim().toLowerCase();

    var $body = $("#driversBody").empty();

    for (var i = 0; i < results.length; i++) {
      var r  = results[i];
      // PHP ResultsController returns: r.position, r.driverNumber, r.gap, r.status, r.driver{}
      var d  = r.driver || {};
      var fullName = (d.fullName || "").trim() || ("#" + r.driverNumber);
      var team     = (d.teamName || "").trim();
      var isFav    = (favDriver && fullName.toLowerCase() === favDriver) ||
                     (favTeam   && team.toLowerCase()     === favTeam);

      var $tr = $("<tr>").toggleClass("lb-row-fav", isFav);

      $tr.append($("<td>").text(r.position || ""));

      var $driverCell = $("<td>").addClass("lb-driver-cell");
      if (d.headshotUrl) {
        $driverCell.append(
          $("<img>").addClass("lb-headshot").attr({ src: d.headshotUrl, alt: fullName, loading: "lazy" })
        );
      }

      var $driverText = $("<div>").addClass("lb-driver-text");
      $driverText.append($("<div>").addClass("lb-driver-name").text(fullName));

      if (d.acronym || d.countryCode || d.number) {
        $driverText.append(
          $("<div>").addClass("lb-driver-sub muted").text(
            [d.countryCode || "", d.acronym || "", d.number ? ("#" + d.number) : ""]
              .filter(Boolean).join(" · ")
          )
        );
      }

      $driverCell.append($driverText);
      $tr.append($driverCell);

      var $teamCell = $("<td>");
      if (d.teamColour) {
        $teamCell.append($("<span>").addClass("lb-team-dot").css("background", "#" + d.teamColour));
      }
      $teamCell.append(document.createTextNode(team || "—"));
      $tr.append($teamCell);

      $tr.append($("<td>").addClass("right").text(r.gap    || "—"));
      $tr.append($("<td>").addClass("right").text(r.status || "—"));

      $body.append($tr);
    }
  }

  return { init: init };
})();

$(function () { LeaderboardPageModel.init(); });
