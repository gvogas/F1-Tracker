var F1Data = {

  /* =========================
     NORMALIZERS
  ========================= */

  normalizeDrivers: function (list) {
    list = Array.isArray(list) ? list : [];

    var byNumber = {}; // dedupe by driver_number
    for (var i = 0; i < list.length; i++) {
      var d = list[i] || {};
      if (d.driver_number == null) continue;

      var num = Number(d.driver_number);
      if (Number.isNaN(num)) continue;

      byNumber[num] = {
        number: num,
        firstName: d.first_name || "",
        lastName: d.last_name || "",
        fullName:
          d.full_name ||
          ((d.first_name || "") + " " + (d.last_name || "")).trim(),
        acronym: d.name_acronym || "",
        broadcastName: d.broadcast_name || "",
        country: d.country_code || "",
        teamName: d.team_name || "Unknown",
        teamColour: d.team_colour || null, // hex without #
        headshotUrl: d.headshot_url || "",
        meetingKey: d.meeting_key || null,
        sessionKey: d.session_key || null,
        _raw: d
      };
    }

    return Object.keys(byNumber)
      .map(function (k) { return byNumber[k]; })
      .sort(function (a, b) { return a.number - b.number; });
  },

  teamsFromDrivers: function (driversArr) {
    driversArr = Array.isArray(driversArr) ? driversArr : [];
    var set = {};
    for (var i = 0; i < driversArr.length; i++) {
      var t = driversArr[i].teamName;
      if (t) set[t] = true;
    }
    return Object.keys(set).sort();
  },

  /* =========================
     MEETINGS / SESSIONS
  ========================= */

  getLatestMeeting: function (year) {
    return OpenF1API.meetings({ year: year }).then(function (meetings) {
      meetings = Array.isArray(meetings) ? meetings : [];
      if (!meetings.length) throw new Error("No meetings");

      // Prefer meetings that already started (avoids selecting a future GP)
      var now = Date.now();
      var started = meetings.filter(function (m) {
        var t = Date.parse(m.date_start);
        return !isNaN(t) && t <= now;
      });

      var list = started.length ? started : meetings;

      list.sort(function (a, b) {
        return Date.parse(a.date_start) - Date.parse(b.date_start);
      });

      return list[list.length - 1];
    });
  },

  pickBestSession: function (sessions) {
    sessions = Array.isArray(sessions) ? sessions : [];
    if (!sessions.length) throw new Error("No sessions");

    // oldest -> newest
    sessions.sort(function (a, b) {
      return Date.parse(a.date_start) - Date.parse(b.date_start);
    });

    // Prefer Race, else Sprint, else Qualifying, else latest session
    var prefs = ["Race", "Sprint", "Qualifying"];
    for (var p = 0; p < prefs.length; p++) {
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].session_name === prefs[p]) return sessions[i];
      }
    }

    return sessions[sessions.length - 1];
  },

  /* =========================
     CONVENIENCE FLOWS
  ========================= */
  // latest meeting → best session → normalized drivers
  getLatestDrivers: function (year) {
    return F1Data.getLatestMeeting(year)
      .then(function (m) {
        return OpenF1API.sessions({ meeting_key: m.meeting_key });
      })
      .then(function (sessions) {
        var s = F1Data.pickBestSession(sessions);
        return OpenF1API.drivers({ session_key: s.session_key });
      })
      .then(function (raw) {
        return F1Data.normalizeDrivers(raw || []);
      });
  },

  // drivers for a given session_key (normalized)
  getDriversForSession: function (session_key) {
    return OpenF1API.drivers({ session_key: session_key })
      .then(function (raw) {
        return F1Data.normalizeDrivers(raw || []);
      });
  },

  // convenience: normalized drivers + teams
  driversForSession: function (session_key) {
    return F1Data.getDriversForSession(session_key).then(function (drivers) {
      return {
        drivers: drivers,
        teams: F1Data.teamsFromDrivers(drivers)
      };
    });
  }
};
