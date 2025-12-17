// core/api/openf1.api.js
// Requires jQuery

var OpenF1API = (function () {
  var BASE = "https://api.openf1.org/v1";

  function get(endpoint, params) {
    return $.ajax({
      url: BASE + endpoint,
      method: "GET",
      dataType: "json",
      data: params || {},
      timeout: 15000
    });
  }

  

    function sessions(params) { return get("/sessions", params); }
    function drivers(params) { return get("/drivers", params); }
    function sessionResult(params) { return get("/session_result", params); }
    function meetings(params) { return get("/meetings", params); }

    return { sessions: sessions, drivers: drivers, sessionResult: sessionResult, meetings: meetings };

})();
