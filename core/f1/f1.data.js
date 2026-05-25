/**
 * F1Data — helpers that talk to the PHP API backend.
 * Field names are now camelCase (as returned by PHP models).
 */
var F1Data = {

  /* =========================
     MEETINGS / SESSIONS
  ========================= */

  // Latest meeting whose start time has passed, or null if none have. (list sorted asc by PHP)
  pickLatestStarted: function (meetings) {
    meetings = Array.isArray(meetings) ? meetings : [];
    var now = Date.now();
    var started = meetings.filter(function (m) {
      var t = Date.parse(m.dateStart);
      return !isNaN(t) && t <= now;
    });
    return started.length ? started[started.length - 1] : null;
  },

  getLatestMeeting: function (year) {
    return F1API.meetings({ year: year }).then(function (meetings) {
      meetings = Array.isArray(meetings) ? meetings : [];
      if (!meetings.length) throw new Error("No meetings");
      return F1Data.pickLatestStarted(meetings) || meetings[meetings.length - 1];
    });
  },

  pickBestSession: function (sessions) {
    sessions = Array.isArray(sessions) ? sessions : [];
    if (!sessions.length) throw new Error("No sessions");

    var prefs = ["Race", "Sprint", "Qualifying"];
    for (var p = 0; p < prefs.length; p++) {
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].name === prefs[p]) return sessions[i];
      }
    }
    return sessions[sessions.length - 1]; // already sorted asc by PHP
  },

  /* =========================
     CONVENIENCE FLOWS
  ========================= */

  // latest meeting → best session → normalised drivers
  getLatestDrivers: function (year) {
    return F1Data.getLatestMeeting(year)
      .then(function (m) {
        return F1API.sessions({ meeting_key: m.key });
      })
      .then(function (sessions) {
        var s = F1Data.pickBestSession(sessions);
        return F1API.drivers({ session_key: s.key });
      });
    // PHP already returns normalised drivers; no extra normalisation needed
  },

};
