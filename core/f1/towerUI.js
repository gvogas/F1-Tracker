var TowerUI = (function () {

  function render(rows) {
    rows = Array.isArray(rows) ? rows : [];

    var $tower = $("#tower");
    if (!$tower.length) return;

    $tower.empty();

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];

      var $row = $("<div/>")
        .addClass("tower-row")
        .attr("data-driver", r.driverNumber);

      // Position
      $row.append(
        $("<div/>").addClass("t-pos").text(r.position)
      );

      // Driver code tag (VER / LEC / etc)
      $row.append(
        $("<div/>").addClass("t-code")
          .append($("<span/>").text(r.code))
      );

      // DRS
      $row.append(
        $("<div/>")
          .addClass("t-drs " + (r.drsState || "off"))
          .text("DRS")
      );

      // Tyre
      $row.append(
        $("<div/>")
          .addClass("t-tyre " + (r.tyreClass || ""))
          .text(r.tyreLetter || "-")
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

      // Last lap + best lap (bestLap is placeholder for now)
      $row.append(
        $("<div/>").addClass("t-last")
          .append($("<div/>").addClass("main").text(r.lastLap || "—"))
          .append($("<div/>").addClass("sub").text(r.bestLap || "—"))
      );

      // Sector mini-bars (percent widths passed in)
      $row.append(
        $("<div/>").addClass("t-sectors")
          .append(sectorBar("s1", r.s1p))
          .append(sectorBar("s2", r.s2p))
          .append(sectorBar("s3", r.s3p))
      );

      $tower.append($row);
    }
  }

  function sectorBar(cls, pct) {
    pct = Number(pct);
    if (!isFinite(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    return $("<div/>")
      .addClass("t-s " + cls)
      .css("--p", pct);
  }

  return {
    render: render
  };
})();
