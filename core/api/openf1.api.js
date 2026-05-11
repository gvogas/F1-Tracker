var OpenF1API = {

  BASE: "https://api.openf1.org/v1",

  /* ===== Core GET =====
     Returns a jQuery Deferred promise.
     Skips the request entirely when F1Utils rate-limit backoff is active.
  ===== */
  get: function (endpoint, params) {
    if (typeof F1Utils !== "undefined" && F1Utils.isBackingOff()) {
      return $.Deferred().resolve([]).promise();
    }

    return $.ajax({
      url: OpenF1API.BASE + endpoint,
      method: "GET",
      dataType: "json",
      data: params || {},
      timeout: 20000
    }).fail(function (xhr) {
      if (xhr && (xhr.status === 429 || xhr.status === 503)) {
        if (typeof F1Utils !== "undefined") {
          var retryAfter = (xhr.getResponseHeader && parseInt(xhr.getResponseHeader("Retry-After"), 10)) || 0;
          F1Utils.setBackoff(retryAfter > 0 ? retryAfter * 1000 : 8000);
        }
      }
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
