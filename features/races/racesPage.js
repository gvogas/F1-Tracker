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

  // Friendly relative time for upcoming races.
  function countdownText(d, now) {
    var days = Math.ceil((d.getTime() - now) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days < 14)  return "In " + days + " days";
    return "In " + Math.round(days / 7) + " weeks";
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
            '<div class="state-box"><i class="fa-solid fa-calendar-xmark state-icon"></i>'
            + 'No races found for ' + year + '.</div>'
          );
          return;
        }

        var now  = Date.now();
        var html = "";
        for (var i = 0; i < meetings.length; i++) {
          var m       = meetings[i]; // PHP camelCase: m.key, m.name, m.dateStart, m.countryName
          var name    = m.name || "Grand Prix";
          var country = m.countryName || "";
          var loc     = m.location || country;
          var flag    = getFlag(country);
          var d       = m.dateStart ? new Date(m.dateStart) : null;
          var hasDate = d && !isNaN(d);
          var dateStr = hasDate
            ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : "";
          var isPast  = hasDate && d.getTime() < now;

          var badge = !hasDate ? ""
            : isPast
              ? '<span class="race-badge past"><i class="fa-solid fa-flag-checkered"></i> Completed</span>'
              : '<span class="race-badge upcoming"><i class="fa-regular fa-clock"></i> ' + F1Utils.escapeHtml(countdownText(d, now)) + '</span>';

          html += '<button class="race-card' + (isPast ? " race-card--past" : " race-card--future") + '" data-key="' + m.key + '" type="button">'
            + '<div class="race-card-head"><span class="race-card-flag">' + flag + '</span>' + badge + '</div>'
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
          '<div class="state-box state-error"><i class="fa-solid fa-triangle-exclamation state-icon"></i>'
          + '<div>Couldn\'t load the race calendar.</div>'
          + '<button class="retry-btn" type="button" id="racesRetry">Retry</button></div>'
        );
        $("#racesRetry").on("click", loadMeetings);
      });
  }

  return { init: init };
})();

$(document).ready(function () { RacesPage.init(); });
