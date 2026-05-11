var ProfilePageModel = {

  DRIVER_PLACEHOLDER: "Click a driver below",
  TEAM_PLACEHOLDER:   "Click a driver below",

  state: {
    year: new Date().getFullYear(),
    drivers: [],
    selectedDriver: null
  },

  init: function () {
    HeaderModel.createHeader();

    var prefs = (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load)
      ? UserPrefsModel.load()
      : {};

    $("#name").val(prefs.name || "");

    F1UI.setPill("#favoriteDriver", prefs.favoriteDriver || "", ProfilePageModel.DRIVER_PLACEHOLDER);
    F1UI.setPill("#favoriteTeam",   prefs.favoriteTeam   || "", ProfilePageModel.TEAM_PLACEHOLDER);

    ProfilePageModel.bindEvents();
    ProfilePageModel.loadDrivers();
  },

  bindEvents: function () {
    $("#driverSearch").on("input", function () {
      ProfilePageModel.repaintGrid();
    });

    $(document).on("click", ".chip[data-type='driver']", function () {
      var num = String($(this).data("num") || "").trim();
      var d   = ProfilePageModel.findDriverByNum(num);
      if (!d) return;

      ProfilePageModel.state.selectedDriver = d;

      F1UI.setPill("#favoriteDriver", d.fullName  || "", ProfilePageModel.DRIVER_PLACEHOLDER);
      F1UI.setPill("#favoriteTeam",   d.teamName  || "", ProfilePageModel.TEAM_PLACEHOLDER);

      ProfilePageModel.repaintGrid();
    });

    $("#saveBtn").on("click", function () {
      ProfilePageModel.save();
    });

    $("#clearBtn").on("click", function () {
      ProfilePageModel.clear();
    });
  },

  loadDrivers: function () {
    $("#msg").text("Loading drivers…").show();
    $("#driverGrid").html(ProfilePageModel.buildSkeleton(6));

    F1Data.getLatestDrivers(ProfilePageModel.state.year)
      .then(function (drivers) {
        ProfilePageModel.state.drivers = drivers || [];
        $("#msg").text("").hide();
        ProfilePageModel.repaintGrid();
      })
      .catch(function () {
        ProfilePageModel.state.drivers = [];
        $("#msg").text("Failed to load drivers. Check your connection.").show();
        $("#driverGrid").empty();
      });
  },

  save: function () {
    var driverName = F1UI.getPillValue("#favoriteDriver");
    var teamName   = F1UI.getPillValue("#favoriteTeam");

    var next = {
      name:          $("#name").val().trim(),
      favoriteDriver: driverName,
      favoriteTeam:   teamName
    };

    var d = ProfilePageModel.state.selectedDriver;
    if (d) {
      next.favoriteDriverNumber  = d.number    || "";
      next.favoriteDriverAcronym = d.acronym   || "";
      next.favoriteDriverHeadshot = d.headshotUrl || "";
      next.favoriteTeamColour    = d.teamColour || "";
    }

    if (typeof UserPrefsModel !== "undefined" && UserPrefsModel.save) {
      UserPrefsModel.save(next);
    }

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    F1Utils.toast("Preferences saved ✓");
  },

  clear: function () {
    if (typeof UserPrefsModel !== "undefined" && UserPrefsModel.clear) {
      UserPrefsModel.clear();
    }

    $("#name").val("");

    ProfilePageModel.state.selectedDriver = null;

    F1UI.setPill("#favoriteDriver", "", ProfilePageModel.DRIVER_PLACEHOLDER);
    F1UI.setPill("#favoriteTeam",   "", ProfilePageModel.TEAM_PLACEHOLDER);

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    F1Utils.toast("Preferences cleared");
  },

  repaintGrid: function () {
    F1UI.renderDriverGrid($("#driverGrid"), ProfilePageModel.state.drivers, {
      search:       $("#driverSearch").val(),
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
  },

  buildSkeleton: function (count) {
    var html = "";
    for (var i = 0; i < count; i++) {
      html += '<div class="skel" style="height:56px;border-radius:12px"></div>';
    }
    return html;
  }

};

$(document).ready(function () {
  ProfilePageModel.init();
});
