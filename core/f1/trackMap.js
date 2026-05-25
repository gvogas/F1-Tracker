/**
 * TrackMap — live canvas map of cars on the circuit.
 *   init(canvasId)                  set up the canvas (Hi-DPI)
 *   seedTrack([{x,y}])              draw the circuit outline (from /api/track-outline)
 *   update(locationRows, driverInfo) plot latest car positions (from /api/location)
 *   clear()                          reset + stop animating
 * driverInfo: { <driverNumber>: { color: "RRGGBB", acronym: "VER", position: 1 } }
 */
var TrackMap = (function () {

  var canvas = null, ctx = null;
  var W = 320, H = 320, dpr = 1;

  var bounds = { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  var trackPoints = [];
  var initialized = false, seeded = false;

  var targets = {};   // num -> {x,y}   latest reported position
  var current = {};   // num -> {x,y}   eased on-screen position
  var meta    = {};   // num -> {color, acronym, position}
  var history = {};   // num -> [{x,y}] recent reported positions (short trail)
  var rafId   = null;

  /* ===== Init ===== */
  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    setupSize();
    initialized = true;
    drawPlaceholder();
  }

  function setupSize() {
    dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    W = Math.round(rect.width)  || 320;
    H = Math.round(rect.height) || 320;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ===== Seed circuit outline (downsampled {x,y} path) ===== */
  function seedTrack(points) {
    if (!initialized || !Array.isArray(points) || points.length < 10) return;

    var pts = [];
    for (var i = 0; i < points.length; i++) {
      var x = Number(points[i].x), y = Number(points[i].y);
      if (isFinite(x) && isFinite(y)) pts.push({ x: x, y: y });
    }
    if (pts.length < 10) return;

    computeBounds(pts);
    trackPoints = pts;
    seeded = true;
    ensureLoop();
  }

  /* ===== Update car positions ===== */
  function update(locationRows, driverInfo) {
    if (!initialized) return;
    driverInfo  = driverInfo || {};
    locationRows = Array.isArray(locationRows) ? locationRows : [];

    // Latest reported sample per driver
    var latest = {};
    for (var i = 0; i < locationRows.length; i++) {
      var r = locationRows[i] || {};
      var num = Number(r.driver_number);
      if (!num) continue;
      var x = Number(r.x), y = Number(r.y);
      if (!isFinite(x) || !isFinite(y) || (x === 0 && y === 0)) continue;
      var t = Date.parse(r.date || "") || 0;
      if (!latest[num] || t > latest[num]._t) latest[num] = { x: x, y: y, _t: t };
    }

    var nums = Object.keys(latest);
    targets = {};
    nums.forEach(function (num) {
      var p = latest[num];
      targets[num] = { x: p.x, y: p.y };

      var info = driverInfo[num] || {};
      meta[num] = {
        color:    info.color || null,
        acronym:  info.acronym || "",
        position: info.position || 0
      };

      if (!current[num]) current[num] = { x: p.x, y: p.y }; // appear in place

      var h = history[num] || (history[num] = []);
      var last = h[h.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) {
        h.push({ x: p.x, y: p.y });
        if (h.length > 6) h.shift();
      }
    });

    // Forget cars that dropped out of the window
    Object.keys(current).forEach(function (num) {
      if (!targets[num]) { delete current[num]; delete history[num]; delete meta[num]; }
    });

    if (!seeded && nums.length > 0) computeBoundsFromTargets();
    ensureLoop();
  }

  /* ===== Clear ===== */
  function clear() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    targets = {}; current = {}; meta = {}; history = {};
    trackPoints = []; seeded = false;
    if (initialized) drawPlaceholder();
  }

  /* ===== Animation loop ===== */
  function ensureLoop() {
    if (rafId === null) loop();
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    step();
    draw();
  }

  function step() {
    Object.keys(targets).forEach(function (num) {
      var c = current[num] || (current[num] = { x: targets[num].x, y: targets[num].y });
      c.x += (targets[num].x - c.x) * 0.18;
      c.y += (targets[num].y - c.y) * 0.18;
    });
  }

  /* ===== Bounds ===== */
  function computeBounds(pts) {
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var mx = (maxX - minX) * 0.08 || 100;
    var my = (maxY - minY) * 0.08 || 100;
    bounds = { minX: minX - mx, maxX: maxX + mx, minY: minY - my, maxY: maxY + my };
  }

  function computeBoundsFromTargets() {
    var pts = Object.keys(targets).map(function (k) { return targets[k]; });
    if (pts.length) computeBounds(pts);
  }

  /* ===== Data coords → canvas coords (Y flipped) ===== */
  function toCanvas(x, y) {
    var pad = 22;
    var w = W - pad * 2, h = H - pad * 2;
    var rangeX = bounds.maxX - bounds.minX || 1;
    var rangeY = bounds.maxY - bounds.minY || 1;
    return {
      x: pad + ((x - bounds.minX) / rangeX) * w,
      y: pad + (1 - (y - bounds.minY) / rangeY) * h
    };
  }

  /* ===== Draw ===== */
  function draw() {
    if (!initialized || !ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10,10,13,0.96)";
    ctx.fillRect(0, 0, W, H);

    if (seeded && trackPoints.length > 1) drawTrack();

    drawTrails();
    drawCars();

    if (Object.keys(current).length === 0 && !seeded) {
      ctx.fillStyle = "rgba(154,160,176,0.45)";
      ctx.font = "12px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for car positions…", W / 2, H / 2);
    }
  }

  function strokePath(width, style) {
    ctx.beginPath();
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    var p0 = toCanvas(trackPoints[0].x, trackPoints[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (var i = 1; i < trackPoints.length; i++) {
      var p = toCanvas(trackPoints[i].x, trackPoints[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawTrack() {
    // Tarmac ribbon + thin red racing line, then a start/finish checker.
    strokePath(11, "rgba(255,255,255,0.10)");
    strokePath(7,  "rgba(20,20,26,0.95)");
    strokePath(2,  "rgba(225,6,0,0.55)");

    var s = toCanvas(trackPoints[0].x, trackPoints[0].y);
    var sq = 3;
    for (var r = 0; r < 2; r++) {
      for (var c = 0; c < 2; c++) {
        ctx.fillStyle = ((r + c) % 2 === 0) ? "#fff" : "#111";
        ctx.fillRect(s.x - sq + c * sq, s.y - sq + r * sq, sq, sq);
      }
    }
  }

  function drawTrails() {
    Object.keys(history).forEach(function (num) {
      var h = history[num];
      if (!h || h.length < 2) return;
      var color = meta[num] && meta[num].color ? ("#" + meta[num].color) : "#e10600";
      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(color, 0.28);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      var p0 = toCanvas(h[0].x, h[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (var i = 1; i < h.length; i++) {
        var p = toCanvas(h[i].x, h[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });
  }

  function drawCars() {
    var nums = Object.keys(current);
    for (var k = 0; k < nums.length; k++) {
      var num = nums[k];
      var c = current[num];
      var m = meta[num] || {};
      var pos = toCanvas(c.x, c.y);
      var color = m.color ? ("#" + m.color) : "#e10600";
      var isLeader = m.position === 1;

      // Glow
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isLeader ? 12 : 10, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, 0.22);
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isLeader ? 7 : 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Ring (gold for the leader, white otherwise)
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isLeader ? 7 : 6, 0, Math.PI * 2);
      ctx.strokeStyle = isLeader ? "rgba(255,215,0,0.95)" : "rgba(255,255,255,0.75)";
      ctx.lineWidth = isLeader ? 2 : 1.5;
      ctx.stroke();

      // Acronym label
      if (m.acronym) {
        ctx.font = "700 10px system-ui,sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillText(m.acronym, pos.x + 9 + 1, pos.y + 1);
        ctx.fillStyle = "rgba(242,243,247,0.95)";
        ctx.fillText(m.acronym, pos.x + 9, pos.y);
      }
    }
  }

  function drawPlaceholder() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10,10,13,0.96)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(154,160,176,0.35)";
    ctx.font = "12px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Select a session", W / 2, H / 2 - 8);
    ctx.fillText("to view the track map", W / 2, H / 2 + 10);
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
