var TowerData = (function () {

  /* =========================
     HELPERS
  ========================= */

  function latestByDriver(rows, dateField) {
    var map = {};
    rows = Array.isArray(rows) ? rows : [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var num = Number(r.driver_number);
      if (!num) continue;

      var t = Date.parse(r[dateField] || r.date || r.date_start || "");
      if (!map[num] || (t && t > map[num]._t)) {
        map[num] = Object.assign({}, r, { _t: t || 0 });
      }
    }
    return map;
  }

  function normalizeCompound(compound) {
    compound = String(compound || "").toUpperCase();
    if (compound === "SOFT") return { cls: "soft", letter: "S" };
    if (compound === "MEDIUM") return { cls: "med", letter: "M" };
    if (compound === "HARD") return { cls: "hard", letter: "H" };
    return { cls: "", letter: "-" };
  }

  function normalizeDRS(v) {
    v = Number(v);
    if (v === 10 || v === 12 || v === 14) return "on";
    if (v === 8) return "eligible";
    return "off";
  }

  function fmtGap(v) {
    if (v == null) return "—";
    var n = Number(v);
    if (isNaN(n)) return "—";
    return (n >= 0 ? "+" : "") + n.toFixed(3);
  }

  function fmtLapTime(sec) {
    if (sec == null) return "—";
    var s = Number(sec);
    if (!isFinite(s) || s <= 0) return "—";

    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ":" + (r < 10 ? "0" : "") + r.toFixed(3);
  }

  function sectorPct(part, total) {
    if (!part || !total) return 0;
    var p = (part / total) * 100;
    return Math.max(0, Math.min(100, p));
  }

  /* =========================
     BUILD TIMING TOWER MODEL
  ========================= */

  function build(data) {
    data = data || {};

    var posLatest   = latestByDriver(data.positions || [], "date");
    var intLatest   = latestByDriver(data.intervals || [], "date");
    var stintLatest = latestByDriver(data.stints || [], "lap_start");
    var pitLatest   = latestByDriver(data.pits || [], "date");
    var lapLatest   = latestByDriver(data.laps || [], "date_start");
    var drsLatest   = latestByDriver(data.carData || [], "date");

    // drivers metadata (from F1Data.normalizeDrivers)
    var driverMap = {};
    (data.drivers || []).forEach(function (d) {
      driverMap[d.number] = d;
    });

    // order by position
    var ordered = Object.keys(posLatest)
      .map(function (k) { return posLatest[k]; })
      .sort(function (a, b) {
        return Number(a.position) - Number(b.position);
      });

    var rows = [];

    for (var i = 0; i < ordered.length; i++) {
      var p = ordered[i];
      var num = Number(p.driver_number);

      var drv = driverMap[num] || {};
      var iv  = intLatest[num] || {};
      var st  = stintLatest[num] || {};
      var pt  = pitLatest[num] || {};
      var lp  = lapLatest[num] || {};
      var drs = drsLatest[num] || {};

      var comp = normalizeCompound(st.compound);

      var total = Number(lp.lap_duration) || 0;
      var s1 = Number(lp.duration_sector_1) || 0;
      var s2 = Number(lp.duration_sector_2) || 0;
      var s3 = Number(lp.duration_sector_3) || 0;

      rows.push({
        driverNumber: num,

        position: p.position || "—",
        code: drv.acronym || ("#" + num),

        drsState: normalizeDRS(drs.drs),

        tyreClass: comp.cls,
        tyreLetter: comp.letter,

        lap: lp.lap_number || "—",
        pits: pt.lap_number != null ? 1 : 0, // simple v1

        gap: fmtGap(iv.gap_to_leader),
        interval: fmtGap(iv.interval),

        lastLap: fmtLapTime(lp.lap_duration),
        bestLap: "—", // v1 (can compute later)

        s1p: sectorPct(s1, total),
        s2p: sectorPct(s2, total),
        s3p: sectorPct(s3, total)
      });
    }

    return rows;
  }

  return {
    build: build
  };
})();
