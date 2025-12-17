// features/profile/profile.page.js
// Requires jQuery + HeaderModel + UserPrefsModel

var ProfilePageModel = (function () {

  var DRIVERS = [
    { name: "Max Verstappen", team: "Red Bull" },
    { name: "Sergio Perez", team: "Red Bull" },
    { name: "Lewis Hamilton", team: "Mercedes" },
    { name: "George Russell", team: "Mercedes" },
    { name: "Charles Leclerc", team: "Ferrari" },
    { name: "Carlos Sainz", team: "Ferrari" },
    { name: "Lando Norris", team: "McLaren" },
    { name: "Oscar Piastri", team: "McLaren" },
    { name: "Fernando Alonso", team: "Aston Martin" },
    { name: "Lance Stroll", team: "Aston Martin" },
    { name: "Pierre Gasly", team: "Alpine" },
    { name: "Esteban Ocon", team: "Alpine" },
    { name: "Alexander Albon", team: "Williams" },
    { name: "Logan Sargeant", team: "Williams" },
    { name: "Yuki Tsunoda", team: "RB" },
    { name: "Daniel Ricciardo", team: "RB" },
    { name: "Valtteri Bottas", team: "Sauber" },
    { name: "Zhou Guanyu", team: "Sauber" },
    { name: "Kevin Magnussen", team: "Haas" },
    { name: "Nico Hulkenberg", team: "Haas" }
  ];

  var TEAMS = [
    "Red Bull","Ferrari","McLaren","Mercedes","Aston Martin",
    "Alpine","Williams","RB","Sauber","Haas"
  ];

  var DRIVER_PLACEHOLDER = "Click a driver below";
  var TEAM_PLACEHOLDER   = "Click a team below";

  function init() {
    HeaderModel.createHeader();

    // load prefs
    var prefs = UserPrefsModel.load();
    $("#name").val(prefs.name || "");

    setPill("#favoriteDriver", prefs.favoriteDriver, DRIVER_PLACEHOLDER);
    setPill("#favoriteTeam", prefs.favoriteTeam, TEAM_PLACEHOLDER);

    renderDrivers();
    renderTeams();

    // search filters
    $("#driverSearch").on("input", function () {
      renderDrivers($(this).val());
    });

    $("#teamSearch").on("input", function () {
      renderTeams($(this).val());
    });

    // delegated click for chips
    $(document).on("click", ".chip[data-type='driver']", function () {
      var name = String($(this).data("value") || "").trim();
      setPill("#favoriteDriver", name, DRIVER_PLACEHOLDER);

      $(".chip[data-type='driver']").removeClass("is-selected");
      $(this).addClass("is-selected");
    });

    $(document).on("click", ".chip[data-type='team']", function () {
      var name = String($(this).data("value") || "").trim();
      setPill("#favoriteTeam", name, TEAM_PLACEHOLDER);

      $(".chip[data-type='team']").removeClass("is-selected");
      $(this).addClass("is-selected");
    });

    // save
    $("#saveBtn").on("click", function () {
      var next = {
        name: $("#name").val().trim(),
        favoriteDriver: getPillValue("#favoriteDriver"),
        favoriteTeam: getPillValue("#favoriteTeam")
      };

      UserPrefsModel.save(next);
      HeaderModel.refreshFavText();

      highlightSelected(next.favoriteDriver, next.favoriteTeam);

      $("#msg").text("Saved.").fadeIn(0).delay(900).fadeOut(250);
    });

    // clear
    $("#clearBtn").on("click", function () {
      UserPrefsModel.clear();
      $("#name").val("");

      setPill("#favoriteDriver", "", DRIVER_PLACEHOLDER);
      setPill("#favoriteTeam", "", TEAM_PLACEHOLDER);

      $(".chip").removeClass("is-selected");
      HeaderModel.refreshFavText();

      $("#msg").text("Cleared.").fadeIn(0).delay(900).fadeOut(250);
    });

    // initial highlight
    highlightSelected(getPillValue("#favoriteDriver"), getPillValue("#favoriteTeam"));
  }

  function setPill(sel, value, placeholder) {
    value = (value || "").trim();
    if (value) {
      $(sel).text(value).addClass("has-value");
    } else {
      $(sel).text(placeholder).removeClass("has-value");
    }
  }

  function getPillValue(sel) {
    return $(sel).hasClass("has-value") ? $(sel).text().trim() : "";
  }

  function renderDrivers(search) {
    search = (search || "").toLowerCase().trim();
    var $grid = $("#driverGrid").empty();

    var list = DRIVERS.filter(function (d) {
      if (!search) return true;
      return d.name.toLowerCase().includes(search) || d.team.toLowerCase().includes(search);
    });

    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      var $chip = $("<div>")
        .addClass("chip")
        .attr("data-type", "driver")
        .attr("data-value", d.name);

      var $left = $("<div>").text(d.name);
      var $right = $("<div>").addClass("chip-meta").text(d.team);

      $chip.append($left, $right);
      $grid.append($chip);
    }

    highlightSelected(getPillValue("#favoriteDriver"), getPillValue("#favoriteTeam"));
  }

  function renderTeams(search) {
    search = (search || "").toLowerCase().trim();
    var $grid = $("#teamGrid").empty();

    var list = TEAMS.filter(function (t) {
      if (!search) return true;
      return t.toLowerCase().includes(search);
    });

    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var $chip = $("<div>")
        .addClass("chip")
        .attr("data-type", "team")
        .attr("data-value", t);

      $chip.append($("<div>").text(t));
      $grid.append($chip);
    }

    highlightSelected(getPillValue("#favoriteDriver"), getPillValue("#favoriteTeam"));
  }

  function highlightSelected(driver, team) {
    driver = (driver || "").trim();
    team = (team || "").trim();

    $(".chip[data-type='driver']").each(function () {
      var v = String($(this).data("value") || "");
      $(this).toggleClass("is-selected", v === driver);
    });

    $(".chip[data-type='team']").each(function () {
      var v = String($(this).data("value") || "");
      $(this).toggleClass("is-selected", v === team);
    });
  }

  return { init: init };

})();

$(document).ready(function () {
  ProfilePageModel.init();
});
