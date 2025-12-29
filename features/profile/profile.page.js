var ProfilePageModel = {

  DRIVER_PLACEHOLDER: "Click a driver below",
  TEAM_PLACEHOLDER: "Click a driver below",

  state: {
    year: new Date().getFullYear(),
    drivers: [],
    selectedDriver: null
  },

  init: function () {
    HeaderModel.createHeader();

    // load prefs into form
    var prefs = (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load)
      ? UserPrefsModel.load()
      : {};

    $("#name").val(prefs.name || "");

    F1UI.setPill("#favoriteDriver", prefs.favoriteDriver || "", ProfilePageModel.DRIVER_PLACEHOLDER);
    F1UI.setPill("#favoriteTeam", prefs.favoriteTeam || "", ProfilePageModel.TEAM_PLACEHOLDER);

    // bind events
    ProfilePageModel.bindEvents();

    // load drivers
    ProfilePageModel.loadDrivers();
  },

  bindEvents: function () {
    // search
    $("#driverSearch").on("input", function () {
      ProfilePageModel.repaintGrid();
    });

    // click driver chip/card sets BOTH driver + team
    $(document).on("click", ".chip[data-type='driver']", function () {
      var num = String($(this).data("num") || "").trim();
      var d = ProfilePageModel.findDriverByNum(num);
      if (!d) return;

      ProfilePageModel.state.selectedDriver = d;

      F1UI.setPill("#favoriteDriver", d.fullName || "", ProfilePageModel.DRIVER_PLACEHOLDER);
      F1UI.setPill("#favoriteTeam", d.teamName || "", ProfilePageModel.TEAM_PLACEHOLDER);

      ProfilePageModel.repaintGrid();
      $("#msg").text("").hide();
    });

    $("#saveBtn").on("click", function () {
      ProfilePageModel.save();
    });

    $("#clearBtn").on("click", function () {
      ProfilePageModel.clear();
    });
  },

  loadDrivers: function () {
    $("#msg").text("Loading drivers from OpenF1...").show();

    F1Data.getLatestDrivers(ProfilePageModel.state.year)
      .then(function (drivers) {
        ProfilePageModel.state.drivers = drivers || [];
        $("#msg").text("").hide();
        ProfilePageModel.repaintGrid();
      })
      .catch(function () {
        ProfilePageModel.state.drivers = [];
        $("#msg").text("Failed to load drivers from OpenF1.").show();
        ProfilePageModel.repaintGrid();
      });
  },

  save: function () {
    var driverName = F1UI.getPillValue("#favoriteDriver");
    var teamName = F1UI.getPillValue("#favoriteTeam");

    var next = {
      name: $("#name").val().trim(),
      favoriteDriver: driverName,
      favoriteTeam: teamName
    };

    // extra fields for auto-fill elsewhere
    var d = ProfilePageModel.state.selectedDriver;
    if (d) {
      next.favoriteDriverNumber = d.number || "";
      next.favoriteDriverAcronym = d.acronym || "";
      next.favoriteDriverHeadshot = d.headshotUrl || "";
      next.favoriteTeamColour = d.teamColour || "";
    }

    if (typeof UserPrefsModel !== "undefined" && UserPrefsModel.save) {
      UserPrefsModel.save(next);
    }

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    $("#msg").text("Saved.").fadeIn(0).delay(900).fadeOut(250);
  },

  clear: function () {
    if (typeof UserPrefsModel !== "undefined" && UserPrefsModel.clear) {
      UserPrefsModel.clear();
    }

    $("#name").val("");

    ProfilePageModel.state.selectedDriver = null;

    F1UI.setPill("#favoriteDriver", "", ProfilePageModel.DRIVER_PLACEHOLDER);
    F1UI.setPill("#favoriteTeam", "", ProfilePageModel.TEAM_PLACEHOLDER);

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    $("#msg").text("Cleared.").fadeIn(0).delay(900).fadeOut(250);
  },

  repaintGrid: function () {
    F1UI.renderDriverGrid($("#driverGrid"), ProfilePageModel.state.drivers, {
      search: $("#driverSearch").val(),
      selectedName: F1UI.getPillValue("#favoriteDriver")
    });
  },

  findDriverByNum: function (numStr) {
    numStr = String(numStr || "");
    for (var i = 0; i < ProfilePageModel.state.drivers.length; i++) {
      if (String(ProfilePageModel.state.drivers[i].number) === numStr) {
        return ProfilePageModel.state.drivers[i];
      }
    }
    return null;
  }

};

$(document).ready(function () {
  ProfilePageModel.init();
});
