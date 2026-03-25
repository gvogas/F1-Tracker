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

  // drivers for a given session_key (already normalised by PHP)
  getDriversForSession: function (session_key) {
    return F1API.drivers({ session_key: session_key });
  },

  /* =========================
     LEGACY NORMALIZER (kept for towerData.js compatibility)
     Handles both snake_case (OpenF1 raw) and camelCase (PHP API) shapes.
  ========================= */

  normalizeDrivers: function (list) {
    list = Array.isArray(list) ? list : [];

    var byNumber = {};
    for (var i = 0; i < list.length; i++) {
      var d = list[i] || {};

      // Support both PHP (camelCase) and raw OpenF1 (snake_case) shapes
      var num = Number(d.number || d.driver_number);
      if (!num || isNaN(num)) continue;

      byNumber[num] = {
        number:        num,
        firstName:     d.firstName  || d.first_name  || "",
        lastName:      d.lastName   || d.last_name   || "",
        fullName:      d.fullName   || d.full_name   ||
                       ((d.firstName || d.first_name || "") + " " + (d.lastName || d.last_name || "")).trim(),
        acronym:       d.acronym    || d.name_acronym || "",
        broadcastName: d.broadcastName || d.broadcast_name || "",
        country:       d.countryCode   || d.country_code   || "",
        teamName:      d.teamName   || d.team_name   || "Unknown",
        teamColour:    d.teamColour || d.team_colour || null,
        headshotUrl:   d.headshotUrl || d.headshot_url || "",
        meetingKey:    d.meetingKey  || d.meeting_key  || null,
        sessionKey:    d.sessionKey  || d.session_key  || null,
      };
    }

    return Object.keys(byNumber)
      .map(function (k) { return byNumber[k]; })
      .sort(function (a, b) { return a.number - b.number; });
  },
};
