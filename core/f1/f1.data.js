var F1Data = {

  getLatestMeeting: function (year) {
    return OpenF1API.meetings({ year: year }).then(function (meetings) {
      meetings = Array.isArray(meetings) ? meetings : [];
      if (!meetings.length) throw new Error("No meetings");

      meetings.sort(function (a, b) {
        return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
      });

      return meetings[meetings.length - 1];
    });
  },

  pickBestSession: function (sessions) {
    sessions = Array.isArray(sessions) ? sessions : [];
    if (!sessions.length) throw new Error("No sessions");

    sessions.sort(function (a, b) {
      return new Date(a.date_start).getTime() - new Date(b.date_start).getTime();
    });

    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].session_name === "Race") return sessions[i];
    }

    return sessions[sessions.length - 1];
  },

  // Convenience: latest meeting → best session → normalized drivers
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
        return OpenF1API.normalizeDrivers(raw || []);
      });
  },

  // General: drivers for a given session_key (normalized)
  getDriversForSession: function (session_key) {
    return OpenF1API.drivers({ session_key: session_key })
      .then(function (raw) {
        return OpenF1API.normalizeDrivers(raw || []);
      });
  }

};
