var ProfilePageModel = {

  DRIVER_PLACEHOLDER: "Click a driver to select",
  TEAM_PLACEHOLDER:   "Auto-filled from driver",

  state: {
    year:           new Date().getFullYear(),
    drivers:        [],
    selectedDriver: null
  },

  init: function () {
    if (typeof HeaderModel !== "undefined") HeaderModel.createHeader();

    var prefs = (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load)
      ? UserPrefsModel.load()
      : {};

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
    $("#driverGrid").html(ProfilePageModel.buildSkeleton(6));

    F1Data.getLatestDrivers(ProfilePageModel.state.year)
      .then(function (drivers) {
        ProfilePageModel.state.drivers = Array.isArray(drivers) ? drivers : [];
        $("#profileMsg").text("").hide();
        ProfilePageModel.repaintGrid();
      })
      .catch(function () {
        ProfilePageModel.state.drivers = [];
        $("#profileMsg").text("Failed to load drivers. Check your connection.").show();
        $("#driverGrid").empty();
      });
  },

  save: function () {
    var driverName = F1UI.getPillValue("#favoriteDriver");
    var teamName   = F1UI.getPillValue("#favoriteTeam");
    var d          = ProfilePageModel.state.selectedDriver;

    var next = { favoriteDriver: driverName, favoriteTeam: teamName };
    if (d) {
      next.favoriteDriverNumber  = d.number      || "";
      next.favoriteDriverAcronym = d.acronym     || "";
      next.favoriteDriverHeadshot = d.headshotUrl || "";
      next.favoriteTeamColour    = d.teamColour  || "";
    }

    UserPrefsModel.save(next);

    if (typeof HeaderModel !== "undefined" && HeaderModel.refreshFavText) {
      HeaderModel.refreshFavText();
    }

    ProfilePageModel.repaintGrid();
    $("#profileMsg").text("Saved!").show();
    setTimeout(function () { $("#profileMsg").fadeOut(300); }, 1500);
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
    $("#profileMsg").text("Cleared.").show();
    setTimeout(function () { $("#profileMsg").fadeOut(300); }, 1500);
  },

  repaintGrid: function () {
    F1UI.renderDriverGrid($("#driverGrid"), ProfilePageModel.state.drivers, {
      search:       $("#searchInput").val(),
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
      html += '<div class="skel" style="height:56px;border-radius:12px;margin-bottom:8px"></div>';
    }
    return html;
  }
};

$(document).ready(function () { ProfilePageModel.init(); });
