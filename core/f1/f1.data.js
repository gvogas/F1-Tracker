/**
 * F1Data — helpers that talk to the PHP API backend.
 * Field names are now camelCase (as returned by PHP models).
 */
var F1Data = {

  /* =========================
     MEETINGS / SESSIONS
  ========================= */

  getLatestMeeting: function (year) {
    return F1API.meetings({ year: year }).then(function (meetings) {
      meetings = Array.isArray(meetings) ? meetings : [];
      if (!meetings.length) throw new Error("No meetings");

      var now     = Date.now();
      var started = meetings.filter(function (m) {
        var t = Date.parse(m.dateStart);
        return !isNaN(t) && t <= now;
      });

      var list = started.length ? started : meetings;
      return list[list.length - 1]; // already sorted asc by PHP
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
