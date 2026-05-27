// Converts PHP tower row objects into the format TowerUI.render() expects.
var TowerAdapter = {
  adaptRows: function (rows) {
    return (rows || []).map(function (r) {
      var driver    = r.driver || {};
      var compound  = String(r.compound || "");
      var tyreClass = compound === "S" ? "soft"
                    : compound === "M" ? "med"
                    : compound === "H" ? "hard" : "";
      var drs      = Number(r.drs || 0);
      var drsState = (drs === 10 || drs === 12 || drs === 14) ? "on"
                   : drs === 8 ? "eligible" : "off";
      var s1 = Number(r.sector1 || 0);
      var s2 = Number(r.sector2 || 0);
      var s3 = Number(r.sector3 || 0);
      var tot = s1 + s2 + s3;

      return {
        driverNumber: r.driverNumber,
        position:     r.position,
        code:         driver.acronym || ("#" + r.driverNumber),
        drsState:     drsState,
        tyreClass:    tyreClass,
        tyreLetter:   compound || "-",
        lap:          r.lapNumber,
        pits:         r.pitCount,
        gap:          r.gap,
        interval:     r.interval,
        lastLap:      r.lastLap,
        bestLap:      "—",
        s1p:          tot > 0 ? (s1 / tot * 100) : 0,
        s2p:          tot > 0 ? (s2 / tot * 100) : 0,
        s3p:          tot > 0 ? (s3 / tot * 100) : 0,
      };
    });
  }
};
