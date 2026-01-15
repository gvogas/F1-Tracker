var TowerUI = (function () {

  /* ===== Differential render =====
     Instead of wiping the DOM every second, we update only cells that changed.
     Each row is keyed by data-driver attribute.
  ===== */
  function render(rows) {
    rows = Array.isArray(rows) ? rows : [];

    var $tower = $("#tower");
    if (!$tower.length) return;

    // Read current favorite driver number once
    var favNum = "";
    if (typeof UserPrefsModel !== "undefined" && UserPrefsModel.load) {
      var prefs = UserPrefsModel.load();
      favNum = String(prefs.favoriteDriverNumber || "");
    }

    // Build set of driver numbers in new data
    var newNums = {};
    rows.forEach(function (r) { newNums[String(r.driverNumber)] = true; });

    // Remove rows for drivers no longer in data
    $tower.children(".tower-row").each(function () {
      var dNum = $(this).attr("data-driver");
      if (!newNums[dNum]) $(this).remove();
    });

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = String(r.driverNumber);
      var $existing = $tower.find('.tower-row[data-driver="' + key + '"]');

      if ($existing.length) {
        // Update cells in place
        updateRow($existing, r, favNum);
        // Re-order: move to correct position
        var $atPos = $tower.children(".tower-row").eq(i);
        if ($atPos.length && $atPos.attr("data-driver") !== key) {
          $existing.insertBefore($atPos);
        }
      } else {
        // Create new row and insert at correct position
        var $row = buildRow(r, favNum);
        var $atPos2 = $tower.children(".tower-row").eq(i);
        if ($atPos2.length) {
          $row.insertBefore($atPos2);
        } else {
          $tower.append($row);
        }
      }
    }
  }

  /* ===== Build a new row DOM element ===== */
  function buildRow(r, favNum) {
    var teamColor = r.teamColour ? ("#" + r.teamColour) : "transparent";
    var isFav = favNum && String(r.driverNumber) === favNum;

    var $row = $("<div/>")
      .addClass("tower-row" + (isFav ? " tower-row--fav" : ""))
      .attr("data-driver", String(r.driverNumber))
      .css("--team-color", teamColor);

    // Position
    $row.append($("<div/>").addClass("t-pos").text(r.position));

    // Driver code + team color bar
    var $codeSpan = $("<span/>")
      .text(r.code)
      .css("border-bottom-color", teamColor);
    $row.append($("<div/>").addClass("t-code").append($codeSpan));

    // DRS
    $row.append(
      $("<div/>").addClass("t-drs " + (r.drsState || "off")).text("DRS")
    );

    // Tyre
    $row.append(
      $("<div/>").addClass("t-tyre " + (r.tyreClass || "")).text(r.tyreLetter || "—")
    );

    // Lap + pits
    $row.append(
      $("<div/>").addClass("t-lap")
        .append($("<div/>").addClass("main").text("L " + (r.lap != null ? r.lap : "—")))
        .append($("<div/>").addClass("sub").text("PIT " + (r.pits != null ? r.pits : 0)))
    );

    // Gap + interval
    $row.append(
      $("<div/>").addClass("t-gap")
        .append($("<div/>").addClass("main").text(r.gap || "—"))
        .append($("<div/>").addClass("sub").text(r.interval || "—"))
    );

    // Last lap + best lap
    $row.append(
      $("<div/>").addClass("t-last")
        .append($("<div/>").addClass("main").text(r.lastLap || "—"))
        .append($("<div/>").addClass("sub").text(r.bestLap || "—"))
    );

    // Sector bars
    $row.append(
      $("<div/>").addClass("t-sectors")
        .append(sectorBar("s1", r.s1p))
        .append(sectorBar("s2", r.s2p))
        .append(sectorBar("s3", r.s3p))
    );

    return $row;
  }

  /* ===== Update existing row cells ===== */
  function updateRow($row, r, favNum) {
    var teamColor = r.teamColour ? ("#" + r.teamColour) : "transparent";
    var isFav = favNum && String(r.driverNumber) === favNum;

    $row.css("--team-color", teamColor)
        .toggleClass("tower-row--fav", !!isFav);

    $row.find(".t-pos").text(r.position);
    $row.find(".t-code span")
        .text(r.code)
        .css("border-bottom-color", teamColor);
    $row.find(".t-drs")
        .attr("class", "t-drs " + (r.drsState || "off"))
        .text("DRS");
    $row.find(".t-tyre")
        .attr("class", "t-tyre " + (r.tyreClass || ""))
        .text(r.tyreLetter || "—");
    $row.find(".t-lap .main").text("L " + (r.lap != null ? r.lap : "—"));
    $row.find(".t-lap .sub").text("PIT " + (r.pits != null ? r.pits : 0));
    $row.find(".t-gap .main").text(r.gap || "—");
    $row.find(".t-gap .sub").text(r.interval || "—");
    $row.find(".t-last .main").text(r.lastLap || "—");
    $row.find(".t-last .sub").text(r.bestLap || "—");

    // Update sector bars
    var $sectors = $row.find(".t-sectors");
    $sectors.find(".s1").css("--p", clampPct(r.s1p));
    $sectors.find(".s2").css("--p", clampPct(r.s2p));
    $sectors.find(".s3").css("--p", clampPct(r.s3p));
  }

  function sectorBar(cls, pct) {
    return $("<div/>").addClass("t-s " + cls).css("--p", clampPct(pct));
  }

  function clampPct(pct) {
    pct = Number(pct);
    if (!isFinite(pct) || pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
  }

  return { render: render };
})();
