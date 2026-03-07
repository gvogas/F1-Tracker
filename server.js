/**
 * F1 Tracker — AI Proxy Server
 *
 * Keeps your HuggingFace token server-side so it never touches the browser.
 *
 * Quick start:
 *   1. cp .env.example .env
 *   2. Edit .env and paste your HF token
 *   3. npm install
 *   4. npm start
 *   5. Open http://localhost:3001 in your browser
 *      (or set AI Proxy URL to http://localhost:3001 in Profile)
 *
 * Deploy (free):
 *   Railway  → railway up
 *   Render   → connect repo, set HF_TOKEN env var in dashboard
 *   Fly.io   → fly launch
 *
 * Requires Node 18+
 */

require("dotenv").config();

const express = require("express");
const path    = require("path");
const app     = express();
const PORT    = process.env.PORT || 3001;

const ALLOWED_MODELS = [
  "facebook/bart-large-cnn",
  "google/flan-t5-base"
];

/* ===== Middleware ===== */

// Allow browser to call from file:// or any localhost port
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "512kb" }));

// Serve the app's static files
app.use(express.static(path.join(__dirname)));

/* ===== Routes ===== */

// Health check — used by dashboard to confirm proxy is live
app.get("/health", function (req, res) {
  var ok = Boolean(process.env.HF_TOKEN);
  res.status(ok ? 200 : 503).json({
    ok:  ok,
    msg: ok ? "ready" : "HF_TOKEN not set in .env"
  });
});

// AI inference proxy — adds Bearer token server-side
app.post("/infer", async function (req, res) {
  var model = req.query.model;

  if (!model || !ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: "Unknown or disallowed model: " + (model || "(none)") });
  }

  if (!process.env.HF_TOKEN) {
    return res.status(503).json({ error: "HF_TOKEN not set. Add it to your .env file and restart." });
  }

  try {
    var hfRes = await fetch("https://api-inference.huggingface.co/models/" + model, {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + process.env.HF_TOKEN,
        "Content-Type":  "application/json"
      },
      body:    JSON.stringify(req.body),
      signal:  AbortSignal.timeout(30000)
    });

    var data = await hfRes.json();
    res.status(hfRes.status).json(data);

  } catch (err) {
    res.status(500).json({ error: "Failed to reach HuggingFace: " + err.message });
  }
});

/* ===== Start ===== */

app.listen(PORT, function () {
  console.log("F1 Tracker running at http://localhost:" + PORT);
  if (!process.env.HF_TOKEN) {
    console.warn("  Warning: HF_TOKEN not set — AI features won't work until you add it to .env");
  }
});
