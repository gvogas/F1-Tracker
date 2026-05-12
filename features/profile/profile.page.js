var ProfilePageModel = {

  DRIVER_PLACEHOLDER: "Click a driver to select",
  TEAM_PLACEHOLDER:   "Auto-filled from driver",

  state: {
    year:           new Date().getFullYear(),
    drivers:        [],
    selectedDriver: null
  },

  init: function () {
    HeaderModel.createHeader();

    var prefs = UserPrefsModel.load();
    F1UI.setPill("#favoriteDriver", prefs.favoriteDriver || "", ProfilePageModel.DRIVER_PLACEHOLDER);
    F1UI.setPill("#favoriteTeam",   prefs.favoriteTeam   || "", ProfilePageModel.TEAM_PLACEHOLDER);

    ProfilePageModel.bindEvents();
    ProfilePageModel.loadDrivers();
  },

  bindEvents: function () {
    $("#searchInput").on("input", function () {
      ProfilePageModel.repaintGrid();
    });

    $(document).on("click", ".chip[data-type='driver']", function () {
      var num = String($(this).data("num") || "").trim();
      var d   = ProfilePageModel.findDriverByNum(num);
      if (!d) return;

      ProfilePageModel.state.selectedDriver = d;
      F1UI.setPill("#favoriteDriver", d.fullName || "", ProfilePageModel.DRIVER_PLACEHOLDER);
      F1UI.setPill("#favoriteTeam",   d.teamName || "", ProfilePageModel.TEAM_PLACEHOLDER);

      ProfilePageModel.repaintGrid();
      $("#profileMsg").text("").hide();
    });

    $("#saveBtn").on("click",  function () { ProfilePageModel.save();  });
    $("#clearBtn").on("click", function () { ProfilePageModel.clear(); });
  },

  loadDrivers: function () {
    $("#profileMsg").text("Loading drivers…").show();

    F1Data.getLatestDrivers(ProfilePageModel.state.year)
      .then(function (drivers) {
        ProfilePageModel.state.drivers = Array.isArray(drivers) ? drivers : [];
        $("#profileMsg").text("").hide();
        ProfilePageModel.repaintGrid();
      })
      .catch(function () {
        ProfilePageModel.state.drivers = [];
        $("#profileMsg").text("Failed to load drivers.").show();
      });
  },

  save: function () {
    var driverName = F1UI.getPillValue("#favoriteDriver");
    var teamName   = F1UI.getPillValue("#favoriteTeam");
    var d          = ProfilePageModel.state.selectedDriver;

    var next = { favoriteDriver: driverName, favoriteTeam: teamName };
    if (d) {
      next.favoriteDriverNumber  = d.number     || "";
      next.favoriteDriverAcronym = d.acronym    || "";
      next.favoriteDriverHeadshot = d.headshotUrl || "";
      next.favoriteTeamColour    = d.teamColour || "";
    }

    UserPrefsModel.save(next);

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    $("#profileMsg").text("Saved!").fadeIn(0).delay(1000).fadeOut(300);
  },

  clear: function () {
    UserPrefsModel.clear();
    ProfilePageModel.state.selectedDriver = null;
    F1UI.setPill("#favoriteDriver", "", ProfilePageModel.DRIVER_PLACEHOLDER);
    F1UI.setPill("#favoriteTeam",   "", ProfilePageModel.TEAM_PLACEHOLDER);

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    $("#profileMsg").text("Cleared.").fadeIn(0).delay(1000).fadeOut(300);
  },

  repaintGrid: function () {
    F1UI.renderDriverGrid($("#driverGrid"), ProfilePageModel.state.drivers, {
      search:       $("#searchInput").val(),
      selectedName: F1UI.getPillValue("#favoriteDriver")
    });
  },

  findDriverByNum: function (numStr) {
    numStr = String(numStr || "");
    return ProfilePageModel.state.drivers.find(function (d) {
      return String(d.number) === numStr;
    }) || null;
  }
};

$(document).ready(function () { ProfilePageModel.init(); });
