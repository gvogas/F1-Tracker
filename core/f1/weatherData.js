var WeatherData = (function () {

  function degToCompass(deg) {
    if (deg == null || isNaN(deg)) return "--";
    var dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    var i = Math.round(((deg % 360) / 22.5)) % 16;
    return dirs[i];
  }

  function pickLatest(list) {
    list = Array.isArray(list) ? list : [];
    if (!list.length) return null;

    list.sort(function (a, b) {
      return Date.parse(a.date) - Date.parse(b.date);
    });
    return list[list.length - 1];
  }

  function normalize(w) {
    if (!w) return null;

    var windDir = degToCompass(w.wind_direction);
    var windSpd = (w.wind_speed != null) ? Number(w.wind_speed).toFixed(1) : "--";

    return {
      date: w.date || null,

      airC: (w.air_temperature != null) ? Math.round(w.air_temperature) : null,
      trackC: (w.track_temperature != null) ? Math.round(w.track_temperature) : null,
      humidityPct: (w.humidity != null) ? Math.round(w.humidity) : null,

      rainfallMm: (w.rainfall != null) ? Number(w.rainfall) : 0,
      pressureHpa: (w.pressure != null) ? Number(w.pressure) : null,

      windDirDeg: (w.wind_direction != null) ? Number(w.wind_direction) : null,
      windDirText: windDir,
      windSpeed: (w.wind_speed != null) ? Number(w.wind_speed) : null,
      windSpeedText: windSpd,

      meetingKey: w.meeting_key || null,
      sessionKey: w.session_key || null,

      _raw: w
    };
  }

  // Fetch latest weather sample for a session
  function getLatestForSession(session_key) {
    return OpenF1API.weather({ session_key: session_key })
      .then(function (rows) {
        var latest = pickLatest(rows);
        return normalize(latest);
      });
  }

  // Alternative: fetch for meeting_key (if you prefer)
  function getLatestForMeeting(meeting_key) {
    return OpenF1API.weather({ meeting_key: meeting_key })
      .then(function (rows) {
        var latest = pickLatest(rows);
        return normalize(latest);
      });
  }

    function renderToDashboard(w) {
    if (!w) return;

    $("#wxTrc .wxvalue").text(w.trackC != null ? w.trackC : "--");
    $("#wxAir .wxvalue").text(w.airC != null ? w.airC : "--");
    $("#wxHum .wxvalue").text(w.humidityPct != null ? w.humidityPct : "--");

    // ===== Rain icon (Font Awesome) =====
    var rainIcon = $("#wxRain i");      // <-- ADD THIS
    var rain = Number(w.rainfallMm || 0);

    rainIcon.removeClass("fa-cloud fa-cloud-rain fa-cloud-showers-heavy");

    if (rain <= 0) {
        rainIcon.addClass("fa-cloud");
    } else if (rain < 2) {
        rainIcon.addClass("fa-cloud-rain");
    } else {
        rainIcon.addClass("fa-cloud-showers-heavy");
    }

    // ===== Wind =====
    $("#wxWind .wxvalue").text(w.windDirText || "--");
    $("#wxWind .wxlabel").text((w.windSpeedText || "--") + " m/s");
    }



  return {
    getLatestForSession: getLatestForSession,
    getLatestForMeeting: getLatestForMeeting,
    renderToDashboard: renderToDashboard
  };
})();
