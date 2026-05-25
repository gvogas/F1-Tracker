var TrackMap = (function () {

  var canvas = null;
  var ctx = null;

  // Track bounding box (set from seedTrack)
  var bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };

  // Cached track path (array of {x,y} in data coords)
  var trackPoints = [];

  // Last known car positions: { driverNumber: {x, y, color, acronym} }
  var carPositions = {};

  var initialized = false;
  var seeded = false;

  /* ===== Init ===== */
  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    initialized = true;
    drawPlaceholder();
  }

  /* ===== Seed track outline from historical location data ===== */
  function seedTrack(locationRows) {
    if (!initialized || !Array.isArray(locationRows) || locationRows.length < 10) return;

    // Collect all unique x,y points (sample every 5 rows for performance)
    var points = [];
    for (var i = 0; i < locationRows.length; i += 5) {
      var r = locationRows[i] || {};
      var x = Number(r.x);
      var y = Number(r.y);
      if (isFinite(x) && isFinite(y)) {
        points.push({ x: x, y: y });
      }
    }

    if (points.length < 10) return;

    // Compute bounding box
    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    bounds = {
      minX: Math.min.apply(null, xs),
      maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys),
      maxY: Math.max.apply(null, ys)
    };

    trackPoints = points;
    seeded = true;
    draw();
  }

  /* ===== Update car positions from recent /location data ===== */
  function update(recentLocations, driverColorMap) {
    if (!initialized) return;

    driverColorMap = driverColorMap || {};

    // Keep only the latest position per driver
    var latest = {};
    recentLocations = Array.isArray(recentLocations) ? recentLocations : [];
    for (var i = 0; i < recentLocations.length; i++) {
      var r = recentLocations[i] || {};
      var num = Number(r.driver_number);
      if (!num) continue;
      var t = Date.parse(r.date || "");
      if (!latest[num] || t > (latest[num]._t || 0)) {
        latest[num] = { x: Number(r.x), y: Number(r.y), _t: t };
      }
    }

    // Build car positions map
    var newPos = {};
    Object.keys(latest).forEach(function (num) {
      var p = latest[num];
      if (isFinite(p.x) && isFinite(p.y)) {
        newPos[num] = {
          x: p.x,
          y: p.y,
          color: driverColorMap[num] || null,
          acronym: ""
        };
      }
    });

    carPositions = newPos;

    // If we don't have a seeded track yet, use these positions to approximate bounds
    if (!seeded && Object.keys(newPos).length > 0) {
      var xs = Object.keys(newPos).map(function (k) { return newPos[k].x; });
      var ys = Object.keys(newPos).map(function (k) { return newPos[k].y; });
      bounds = {
        minX: Math.min.apply(null, xs) - 200,
        maxX: Math.max.apply(null, xs) + 200,
        minY: Math.min.apply(null, ys) - 200,
        maxY: Math.max.apply(null, ys) + 200
      };
    }

    draw();
  }

  /* ===== Clear canvas and state ===== */
  function clear() {
    carPositions = {};
    trackPoints = [];
    seeded = false;
    if (initialized) drawPlaceholder();
  }

  /* ===== Map data coords → canvas coords ===== */
  function toCanvas(x, y) {
    var pad = 24; // px padding
    var w = canvas.width - pad * 2;
    var h = canvas.height - pad * 2;

    var rangeX = bounds.maxX - bounds.minX || 1;
    var rangeY = bounds.maxY - bounds.minY || 1;

    // Flip Y axis (data Y may increase downward or upward depending on circuit)
    var cx = pad + ((x - bounds.minX) / rangeX) * w;
    var cy = pad + (1 - (y - bounds.minY) / rangeY) * h;

    return { x: cx, y: cy };
  }

  /* ===== Draw ===== */
  function draw() {
    if (!initialized || !ctx) return;

    var w = canvas.width;
    var h = canvas.height;

    // Background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(7,8,12,0.95)";
    ctx.fillRect(0, 0, w, h);

    // Track outline (if seeded)
    if (seeded && trackPoints.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      var first = toCanvas(trackPoints[0].x, trackPoints[0].y);
      ctx.moveTo(first.x, first.y);
      for (var i = 1; i < trackPoints.length; i++) {
        var p = toCanvas(trackPoints[i].x, trackPoints[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Lighter inner line
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 3;
      var f2 = toCanvas(trackPoints[0].x, trackPoints[0].y);
      ctx.moveTo(f2.x, f2.y);
      for (var j = 1; j < trackPoints.length; j++) {
        var p2 = toCanvas(trackPoints[j].x, trackPoints[j].y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
    }

    // Car dots
    var nums = Object.keys(carPositions);
    for (var k = 0; k < nums.length; k++) {
      var car = carPositions[nums[k]];
      var pos = toCanvas(car.x, car.y);

      var hexColor = car.color ? ("#" + car.color) : "#e10600";

      // Glow
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(hexColor, 0.25);
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = hexColor;
      ctx.fill();

      // White border
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // "No data" hint when no cars yet
    if (nums.length === 0 && !seeded) {
      ctx.fillStyle = "rgba(154,167,194,0.4)";
      ctx.font = "12px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for session data…", w / 2, h / 2);
    }
  }

  function drawPlaceholder() {
    if (!ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(7,8,12,0.95)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(154,167,194,0.3)";
    ctx.font = "12px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Select a session", w / 2, h / 2 - 8);
    ctx.fillText("to view track map", w / 2, h / 2 + 10);
  }

  /* ===== Helpers ===== */
  function hexToRgba(hex, alpha) {
    hex = String(hex || "").replace("#", "");
    if (hex.length !== 6) return "rgba(225,6,0," + alpha + ")";
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  return {
    init: init,
    seedTrack: seedTrack,
    update: update,
    clear: clear
  };
})();
