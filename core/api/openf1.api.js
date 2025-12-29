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
      /* ===== Core ===== */
    meetings: function (params) {
        return OpenF1API.get("/meetings", params);
    },

    sessions: function (params) {
        return OpenF1API.get("/sessions", params);
    },

    drivers: function (params) {
        return OpenF1API.get("/drivers", params);
    },

    /* ===== Car / Timing ===== */
    carData: function (params) {
        return OpenF1API.get("/car_data", params);
    },

    laps: function (params) {
        return OpenF1API.get("/laps", params);
    },

    intervals: function (params) {
        return OpenF1API.get("/intervals", params);
    },

    position: function (params) {
        return OpenF1API.get("/position", params);
    },

    stints: function (params) {
        return OpenF1API.get("/stints", params);
    },

    pit: function (params) {
        return OpenF1API.get("/pit", params);
    },

    /* ===== Location / Movement ===== */
    location: function (params) {
        return OpenF1API.get("/location", params);
    },

    overtakes: function (params) {
        return OpenF1API.get("/overtakes", params);
    },

    /* ===== Results / Grid (BETA) ===== */
    sessionResult: function (params) {
        return OpenF1API.get("/session_result", params);
    },

    startingGrid: function (params) {
        return OpenF1API.get("/starting_grid", params);
    },

    /* ===== Control / Radio ===== */
    raceControl: function (params) {
        return OpenF1API.get("/race_control", params);
    },

    teamRadio: function (params) {
        return OpenF1API.get("/team_radio", params);
    },

    /* ===== Environment ===== */
    weather: function (params) {
        return OpenF1API.get("/weather", params);
    }
};
