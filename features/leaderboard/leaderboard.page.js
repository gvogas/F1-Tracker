var LeaderboardPageModel = (function () {

  var state = {
    year:        new Date().getFullYear(),
    meeting_key: null,
    session_key: null
  };

  function init() {
    HeaderModel.createHeader();

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

  /* ===== Meetings ===== */
  function loadMeetings(force) {
    $("#lbMsg").text("Loading meetings…");
    $("#driversBody").empty();
    $("#lbTitle").text("Leaderboard");

    F1API.meetings({ year: state.year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        if (!meetings.length) {
          $("#lbMsg").text("No meetings found for " + state.year + ".");
          return;
        }

        var prev = (!force && state.meeting_key) ? state.meeting_key : $("#meetingSelect").val();
        $("#meetingSelect").empty();

        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i]; // PHP returns camelCase: m.key, m.name, m.dateStart
          var label = meetingLabel(m);
          $("#meetingSelect").append($("<option>").val(String(m.key)).text(label));
        }

        var pick = (prev && $("#meetingSelect option[value='" + prev + "']").length)
          ? prev
          : String(meetings[meetings.length - 1].key);

        state.meeting_key = pick;
        $("#meetingSelect").val(pick);
        loadSessionsForMeeting(pick, force);
      })
      .fail(function () { $("#lbMsg").text("Failed to load meetings."); });
  }

  function meetingLabel(m) {
    var name = m.name || m.officialName || "Grand Prix";
    var d    = m.dateStart ? new Date(m.dateStart) : null;
    if (!d || isNaN(d.getTime())) return name;
    var mon = d.toLocaleDateString(undefined, { month: "short" });
    var day = d.toLocaleDateString(undefined, { day:   "2-digit" });
    return name + " · " + mon + " " + day;
  }

  /* ===== Sessions ===== */
  function loadSessionsForMeeting(meetingKey, force) {
    if (!meetingKey) return;

    $("#lbMsg").text("Loading sessions…");
    $("#driversBody").empty();
    $("#sessionSelect").empty();

    F1API.sessions({ meeting_key: meetingKey })
      .done(function (sessions) {
        sessions = Array.isArray(sessions) ? sessions : [];
        if (!sessions.length) {
          $("#lbMsg").text("No sessions found for this meeting.");
          return;
        }

        // Update title from last session
        var last = sessions[sessions.length - 1];
        var titleBits = [];
        if (last.location)    titleBits.push(last.location);
        if (last.year)        titleBits.push(String(last.year));
        $("#lbTitle").text(titleBits.length ? "Leaderboard · " + titleBits.join(" ") : "Leaderboard");

        var prev = (!force && state.session_key) ? state.session_key : null;
        for (var i = 0; i < sessions.length; i++) {
          var s = sessions[i]; // s.key, s.name, s.dateStart
          $("#sessionSelect").append($("<option>").val(String(s.key)).text(sessionLabel(s)));
        }

        var pick = (prev && $("#sessionSelect option[value='" + prev + "']").length)
          ? prev
          : String(F1Data.pickBestSession(sessions).key);

        state.session_key = pick;
        $("#sessionSelect").val(pick);
        $("#lbMsg").text("");
        loadResults(pick);
      })
      .fail(function () { $("#lbMsg").text("Failed to load sessions."); });
  }

  function sessionLabel(s) {
    var name = s.name || "Session";
    var d    = s.dateStart ? new Date(s.dateStart) : null;
    if (!d || isNaN(d.getTime())) return name;
    var day  = d.toLocaleDateString(undefined, { weekday: "short" });
    var time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return name + " · " + day + " " + time;
  }

  /* ===== Results (joined by PHP) ===== */
  function loadResults(sessionKey) {
    $("#lbMsg").text("Loading results…");
    $("#driversBody").empty();

    F1API.results({ session_key: sessionKey })
      .done(function (results) {
        results = Array.isArray(results) ? results : [];
        render(results);
        $("#lbMsg").text(results.length ? "" : "No results found for this session.");
      })
      .fail(function () { $("#lbMsg").text("Failed to load results."); });
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
          $("<img>").addClass("lb-headshot").attr("src", d.headshotUrl).attr("alt", fullName)
        );
      }

      var $driverText = $("<div>").addClass("lb-driver-text");
      $driverText.append($("<div>").addClass("lb-driver-name").text(fullName));

      if (d.acronym || d.countryCode || d.number) {
        $driverText.append(
          $("<div>").addClass("lb-driver-sub muted").text(
            [d.countryCode || "", d.acronym || "", d.number ? ("#" + d.number) : ""]
              .filter(Boolean).join(" • ")
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
