var WeatherData = (function () {

  function degToCompass(deg) {
    if (deg == null || isNaN(deg)) return "--";
    var dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    var i = Math.round(((deg % 360) / 22.5)) % 16;
    return dirs[i];
  }

  // Normalise a PHP API response (camelCase) to render format
  function normalizeFromApi(w) {
    if (!w || typeof w !== "object") return null;
    return {
      trackC:       w.trackTemp != null ? Math.round(w.trackTemp) : null,
      airC:         w.airTemp   != null ? Math.round(w.airTemp)   : null,
      humidityPct:  w.humidity  != null ? Math.round(w.humidity)  : null,
      rainfallMm:   Number(w.rainfall  || 0),
      windDirText:  w.windCompass || degToCompass(w.windDirection),
      windSpeedText: w.windSpeed != null ? Number(w.windSpeed).toFixed(1) : "--",
      windSpeed:    w.windSpeed  != null ? Number(w.windSpeed) : null,
      pressureHpa:  w.pressure   != null ? Number(w.pressure)  : null,
      sessionKey:   w.sessionKey || null,
      meetingKey:   w.meetingKey || null,
    };
  }

  // Fetch latest weather for a session via PHP backend
  function getLatestForSession(session_key) {
    return F1API.weather({ session_key: session_key })
      .then(function (w) {
        return normalizeFromApi(w);
      });
  }

  function renderToDashboard(w) {
    if (!w) return;

    $("#wxTrc .wxvalue").text(w.trackC != null ? w.trackC : "--");
    $("#wxAir .wxvalue").text(w.airC   != null ? w.airC   : "--");
    $("#wxHum .wxvalue").text(w.humidityPct != null ? w.humidityPct : "--");

    var rainIcon = $("#wxRain i");
    var rain = Number(w.rainfallMm || 0);
    rainIcon.removeClass("fa-cloud fa-cloud-rain fa-cloud-showers-heavy");
    if (rain <= 0)     rainIcon.addClass("fa-cloud");
    else if (rain < 2) rainIcon.addClass("fa-cloud-rain");
    else               rainIcon.addClass("fa-cloud-showers-heavy");

    $("#wxWind .wxvalue").text(w.windDirText  || "--");
    $("#wxWind .wxlabel").text((w.windSpeedText || "--") + " m/s");
  }

  return {
    getLatestForSession: getLatestForSession,
    renderToDashboard:   renderToDashboard,
  };
})();
