var RacesPage = (function () {
  var year = new Date().getFullYear();

  // Country → emoji flag map
  var flagMap = {
    "Australia": "🇦🇺", "Austria": "🇦🇹", "Azerbaijan": "🇦🇿",
    "Bahrain": "🇧🇭", "Belgium": "🇧🇪", "Brazil": "🇧🇷",
    "Canada": "🇨🇦", "China": "🇨🇳", "France": "🇫🇷",
    "Germany": "🇩🇪", "Hungary": "🇭🇺", "Italy": "🇮🇹",
    "Japan": "🇯🇵", "Mexico": "🇲🇽", "Monaco": "🇲🇨",
    "Netherlands": "🇳🇱", "Portugal": "🇵🇹", "Qatar": "🇶🇦",
    "Saudi Arabia": "🇸🇦", "Singapore": "🇸🇬", "Spain": "🇪🇸",
    "United Arab Emirates": "🇦🇪", "United Kingdom": "🇬🇧",
    "United States": "🇺🇸", "USA": "🇺🇸", "Vietnam": "🇻🇳"
  };

  function getFlag(country) {
    if (!country) return "🏁";
    return flagMap[country] || "🏁";
  }

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
    for (var i = y; i >= y - 6; i--) {
      $sel.append('<option value="' + i + '">' + i + '</option>');
    }
    $sel.val(String(year));
  }

  function loadMeetings() {
    // Skeleton loading cards
    var skels = "";
    for (var s = 0; s < 6; s++) {
      skels += '<div class="skel skel-row" style="height:90px;border-radius:16px"></div>';
    }
    $("#racesGrid").html('<div class="race-loading">' + skels + '</div>');

    F1API.meetings({ year: year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];

        if (!meetings.length) {
          $("#racesGrid").html(
            '<div class="muted"><i class="fa-solid fa-calendar-xmark" style="font-size:32px;opacity:.3;margin-bottom:12px;display:block"></i>No races found for ' + year + '.</div>'
          );
          return;
        }

        // PHP already sorts asc; sort client-side as safety net
        meetings.sort(function (a, b) {
          return Date.parse(a.dateStart) - Date.parse(b.dateStart);
        });

        var now  = Date.now();
        var html = "";
        for (var i = 0; i < meetings.length; i++) {
          var m       = meetings[i]; // PHP camelCase: m.key, m.name, m.dateStart, m.countryName
          var name    = m.name || "Grand Prix";
          var country = m.countryName || "";
          var loc     = m.location || country;
          var flag    = getFlag(country);
          var d       = m.dateStart ? new Date(m.dateStart) : null;
          var dateStr = (d && !isNaN(d))
            ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : "";
          var isPast  = d && d.getTime() < now;

          html += '<button class="race-card' + (isPast ? "" : " race-card--future") + '" data-key="' + m.key + '" type="button">'
            + '<div class="race-card-flag">' + flag + '</div>'
            + '<div class="race-title">' + F1Utils.escapeHtml(name) + '</div>'
            + '<div class="race-sub">' + F1Utils.escapeHtml(loc) + (country && loc !== country ? " · " + F1Utils.escapeHtml(country) : "") + '</div>'
            + '<div class="race-date"><i class="fa-regular fa-calendar" style="opacity:.5"></i> ' + F1Utils.escapeHtml(dateStr) + '</div>'
            + '</button>';
        }

        $("#racesGrid").html(html);

        $(".race-card").on("click", function () {
          window.location.href = "/race?meeting_key=" + encodeURIComponent($(this).data("key"));
        });
      })
      .fail(function () {
        $("#racesGrid").html(
          '<div class="muted"><i class="fa-solid fa-triangle-exclamation" style="font-size:28px;opacity:.4;margin-bottom:10px;display:block"></i>Failed to load races. Check your connection.</div>'
        );
      });
  }

  return { init: init };
})();

$(document).ready(function () { RacesPage.init(); });
