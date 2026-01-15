var RacesPage = (function () {
  var year = new Date().getFullYear();

  // Simple country → emoji flag map for visual flair
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
    HeaderModel.createHeader();
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
    for (var i = y; i >= y - 6; i--) {
      $sel.append('<option value="' + i + '">' + i + '</option>');
    }
    $sel.val(String(year));
  }

  function loadMeetings() {
    // Show skeleton loading cards
    var skels = "";
    for (var s = 0; s < 6; s++) {
      skels += '<div class="skel skel-row" style="height:90px;border-radius:16px"></div>';
    }
    $("#raceGrid").html('<div class="race-loading">' + skels + '</div>');

    OpenF1API.meetings({ year: year })
      .done(function (meetings) {
        meetings = Array.isArray(meetings) ? meetings : [];

        if (!meetings.length) {
          $("#raceGrid").html('<div class="race-empty"><i class="fa-solid fa-calendar-xmark" style="font-size:32px;opacity:.3;margin-bottom:12px;display:block"></i>No races found for ' + year + '.</div>');
          return;
        }

        meetings.sort(function (a, b) {
          return Date.parse(a.date_start) - Date.parse(b.date_start);
        });

        var now = Date.now();
        var html = "";
        for (var i = 0; i < meetings.length; i++) {
          var m = meetings[i];
          var name    = m.meeting_name || "Grand Prix";
          var country = m.country_name || "";
          var loc     = m.location || country;
          var flag    = getFlag(country);
          var d       = m.date_start ? new Date(m.date_start) : null;
          var dateStr = d && !isNaN(d) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
          var isPast  = d && d.getTime() < now;

          html += '<button class="race-card' + (isPast ? '' : ' race-card--future') + '" data-key="' + m.meeting_key + '" type="button">'
            + '<div class="race-card-flag">' + flag + '</div>'
            + '<div class="race-title">' + F1Utils.escapeHtml(name) + '</div>'
            + '<div class="race-sub">' + F1Utils.escapeHtml(loc) + (country && loc !== country ? ' · ' + F1Utils.escapeHtml(country) : '') + '</div>'
            + '<div class="race-date"><i class="fa-regular fa-calendar" style="opacity:.5"></i>' + F1Utils.escapeHtml(dateStr) + '</div>'
            + '</button>';
        }

        $("#raceGrid").html(html);

        $(".race-card").on("click", function () {
          var mk = $(this).data("key");
          window.location.href = "race.html?meeting_key=" + encodeURIComponent(mk);
        });
      })
      .fail(function () {
        $("#raceGrid").html('<div class="race-empty"><i class="fa-solid fa-triangle-exclamation" style="font-size:28px;opacity:.4;margin-bottom:10px;display:block"></i>Failed to load races. Check your connection.</div>');
      });
  }

  return { init: init };
})();

$(document).ready(function () { RacesPage.init(); });
