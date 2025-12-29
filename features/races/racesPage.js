var RacesPage = (function () {
  var year = new Date().getFullYear();

  function init() {
    buildYearSelect();
    $("#yearSelect").on("change", function () {
      year = Number($(this).val()) || year;
      loadMeetings();
    });
    loadMeetings();
  }

  function buildYearSelect() {
    var y = new Date().getFullYear();
    var $sel = $("#yearSelect").empty();
    for (var i = y; i >= y - 5; i--) {
      $sel.append('<option value="' + i + '">' + i + '</option>');
    }
    $sel.val(String(year));
  }

  function loadMeetings() {
    $("#raceGrid").html('<div class="muted">Loading…</div>');

    OpenF1API.meetings({ year: year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];
        meetings.sort(function (a, b) { return Date.parse(a.date_start) - Date.parse(b.date_start); });

        var html = "";
        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i];
          var name = m.meeting_name || "Race";
          var loc = (m.location || "") + (m.country_name ? (" • " + m.country_name) : "");
          var date = m.date_start ? new Date(m.date_start).toLocaleDateString() : "";

          html += ''
            + '<button class="race-card" data-key="' + m.meeting_key + '">'
            + '  <div class="race-title">' + esc(name) + '</div>'
            + '  <div class="race-sub">' + esc(loc) + '</div>'
            + '  <div class="race-date">' + esc(date) + '</div>'
            + '</button>';
        }

        $("#raceGrid").html(html);

        $(".race-card").on("click", function () {
          var mk = $(this).data("key");
          window.location.href = "race.html?meeting_key=" + encodeURIComponent(mk);
        });
      })
      .fail(function (xhr) {
        $("#raceGrid").html('<div class="muted">Failed to load meetings.</div>');
        console.error(xhr);
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
