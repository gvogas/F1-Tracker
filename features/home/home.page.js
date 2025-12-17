var HomePageModel = {

  init: function () {
    // Build header into #header-container
    if (typeof HeaderModel !== "undefined" && typeof HeaderModel.createHeader === "function") {
      HeaderModel.createHeader();
    }

    // Current season
    $("#statSeason").text(new Date().getFullYear());

    // Load user prefs (cookie)
    var prefs = (typeof UserPrefsModel !== "undefined" && typeof UserPrefsModel.load === "function")
      ? UserPrefsModel.load()
      : {};

    // Update chip text
    var bits = [];
    if (prefs.favoriteDriver) bits.push("Driver: " + prefs.favoriteDriver);
    if (prefs.favoriteTeam) bits.push("Team: " + prefs.favoriteTeam);

    $("#favChip").text(bits.length ? bits.join(" • ") : "Set your favorites in Profile");
  }
};

$(function () {
  HomePageModel.init();
    if (typeof SoundModel !== "undefined" && SoundModel.bindUI) {
    SoundModel.bindUI();
}

});
