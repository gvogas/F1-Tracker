var OpenF1API = {

    BASE: "https://api.openf1.org/v1",

    /* ===== Core GET ===== */
    get: function (endpoint, params) {
        return $.ajax({
        url: OpenF1API.BASE + endpoint,
        method: "GET",
        dataType: "json",
        data: params || {},
        timeout: 15000
        });
    },

    /* ===== Endpoints ===== */
    sessions: function (params) {
        return OpenF1API.get("/sessions", params);
    },

    drivers: function (params) {
        return OpenF1API.get("/drivers", params);
    },

    sessionResult: function (params) {
        return OpenF1API.get("/session_result", params);
    },

    meetings: function (params) {
        return OpenF1API.get("/meetings", params);
    },

    /* ===== Normalization ===== */
    normalizeDrivers: function (list) {
        list = Array.isArray(list) ? list : [];

        var byNumber = {}; // dedupe by driver_number

        for (var i = 0; i < list.length; i++) {
        var d = list[i] || {};
        var num = Number(d.driver_number);
        if (!num) continue;

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
            sessionKey: d.session_key || null
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

    /* ===== Convenience ===== */
    driversForSession: function (session_key) {
        return OpenF1API.drivers({ session_key: session_key }).then(function (raw) {
        var norm = OpenF1API.normalizeDrivers(raw || []);
        return {
            drivers: norm,
            teams: OpenF1API.teamsFromDrivers(norm),
            raw: raw
        };
        });
    }
};
