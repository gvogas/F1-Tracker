var RacesPage = (function () {
  var year = new Date().getFullYear();

  function init() {
    if (typeof HeaderModel !== "undefined") HeaderModel.createHeader();
    buildYearSelect();
    $("#yearSelect").on("change", function () {
      year = Number($(this).val()) || year;
      loadMeetings();
    });
    loadMeetings();
  }

  function buildYearSelect() {
    var y   = new Date().getFullYear();
    var $sel = $("#yearSelect").empty();
    for (var i = y; i >= y - 5; i--) {
      $sel.append('<option value="' + i + '">' + i + '</option>');
    }
    $sel.val(String(year));
  }

  function loadMeetings() {
    $("#racesGrid").html('<div class="muted">Loading…</div>');

    F1API.meetings({ year: year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        // PHP already sorts asc; no client re-sort needed

        if (!meetings.length) {
          $("#racesGrid").html('<div class="muted">No races found for ' + year + '.</div>');
          return;
        }

        var html = "";
        for (var i = 0; i < meetings.length; i++) {
          var m    = meetings[i]; // camelCase from PHP: m.key, m.name, m.dateStart, m.countryName
          var name = m.name || "Race";
          var loc  = m.location || "";
          if (m.countryName) loc += (loc ? " • " : "") + m.countryName;
          var date = m.dateStart ? new Date(m.dateStart).toLocaleDateString() : "";

          html += '<button class="race-card card" data-key="' + m.key + '">'
            + '<div class="race-title">' + esc(name) + '</div>'
            + '<div class="race-sub">'   + esc(loc)  + '</div>'
            + '<div class="race-date">'  + esc(date) + '</div>'
            + '</button>';
        }

        $("#racesGrid").html(html);

        $(".race-card").on("click", function () {
          window.location.href = "/race?meeting_key=" + encodeURIComponent($(this).data("key"));
        });
      })
      .fail(function () {
        $("#racesGrid").html('<div class="muted">Failed to load meetings.</div>');
      });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return { init: init };
})();

$(document).ready(function () { RacesPage.init(); });
