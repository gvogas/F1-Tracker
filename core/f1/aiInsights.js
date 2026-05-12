/* ===================================================================
   AI Insights — F1-specific data formatting + HuggingFace AI calls

   Three features:
     1. generateCommentary(raceControlRows)     → #aiCommentary
     2. analyzePerformance(towerRows)           → #aiPerformance
     3. predictOutcome(towerRows, currentLap)   → #aiPrediction
=================================================================== */
var AiInsights = (function () {

  /* ===== DOM Helpers ===== */

  function setLoading(id) {
    $("#" + id).html('<div class="ai-loading">Analyzing with AI…</div>');
  }

  function setResult(id, label, text) {
    if (!text || !text.trim()) {
      setError(id, "The AI returned an empty response. Try again.");
      return;
    }
    $("#" + id).html(
      '<div class="ai-result-label">' + label + '</div>' +
      '<div>' + F1Utils.escapeHtml(text.trim()) + '</div>'
    );
  }

  function setError(id, msg) {
    $("#" + id).html('<div class="ai-error"><i class="fa-solid fa-triangle-exclamation"></i> ' +
      F1Utils.escapeHtml(msg) + '</div>');
  }

  function showNoToken() {
    $("#aiRefreshBtn").hide();
    $("#aiNoToken").show();
  }

  function showHasToken() {
    $("#aiRefreshBtn").show();
    $("#aiNoToken").hide();
  }

  /* ===== Feature 1: Race Commentary =====
     Summarizes the last N race control messages into a natural-language digest.
  ===== */
  function generateCommentary(raceControlRows) {
    raceControlRows = Array.isArray(raceControlRows) ? raceControlRows : [];

    if (!raceControlRows.length) {
      $("#aiCommentary").html('<p class="muted">No race control messages available for this session yet.</p>');
      return;
    }

    setLoading("aiCommentary");

    // Sort by date ascending and take last 20
    var sorted = raceControlRows.slice().sort(function (a, b) {
      return Date.parse(a.date || "") - Date.parse(b.date || "");
    });
    var recent = sorted.slice(-20);

    // Format as a compact readable block for bart summarization
    var lines = recent.map(function (r) {
      var lap  = r.lap_number != null ? "LAP " + r.lap_number + ": " : "";
      var flag = r.flag ? r.flag + " " : "";
      var cat  = r.category ? "[" + r.category + "] " : "";
      var msg  = r.message || "";
      return lap + flag + cat + msg;
    });

    var inputText = lines.join(". ");

    HuggingFaceAPI.summarize(inputText, 140)
      .done(function (resp) {
        var text = Array.isArray(resp) ? (resp[0] && resp[0].summary_text) : (resp && resp.summary_text);
        setResult("aiCommentary", "Race Commentary", text || "");
      })
      .fail(function (err) {
        setError("aiCommentary", err);
      });
  }

  /* ===== Feature 2: Driver Performance Analysis =====
     Builds a structured prompt from tower data and asks flan-t5 to analyze each driver.
  ===== */
  function analyzePerformance(towerRows) {
    towerRows = Array.isArray(towerRows) ? towerRows : [];
    var top8   = towerRows.slice(0, 8);

    if (!top8.length) {
      $("#aiPerformance").html('<p class="muted">No timing data available yet. Select a session and wait for the tower to populate.</p>');
      return;
    }

    setLoading("aiPerformance");

    var driverLines = top8.map(function (r) {
      return "P" + r.position + " " + r.code +
        ": gap=" + r.gap +
        ", lap=" + r.lap +
        ", tyre=" + (r.tyreClass || "?").toUpperCase() +
        ", pits=" + r.pits +
        ", lastLap=" + r.lastLap +
        ", DRS=" + (r.drsState || "off");
    });

    var prompt = "You are a Formula 1 race analyst. " +
      "Based on this live timing data, give a 1-sentence performance summary for each driver. " +
      "Focus on pace, tyre strategy, and race position. Be specific and technical:\n" +
      driverLines.join("\n");

    HuggingFaceAPI.generate(prompt, 250)
      .done(function (resp) {
        var text = extractGeneratedText(resp);
        setResult("aiPerformance", "Driver Performance Analysis", text);
      })
      .fail(function (err) {
        setError("aiPerformance", err);
      });
  }

  /* ===== Feature 3: Race Outcome Predictor =====
     Uses current standings + tyre info to predict the likely top 3 finishers.
  ===== */
  function predictOutcome(towerRows, currentLap) {
    towerRows  = Array.isArray(towerRows) ? towerRows : [];
    currentLap = Number(currentLap) || 0;
    var top10  = towerRows.slice(0, 10);

    if (!top10.length) {
      $("#aiPrediction").html('<p class="muted">No race data available yet. Select an active session.</p>');
      return;
    }

    setLoading("aiPrediction");

    // Estimate total laps (70 default — common race length)
    var totalLaps = 70;
    if (currentLap > 0) {
      // If we're past lap 5 we can keep the 70-lap default;
      // the model just needs a rough sense of race completion
      totalLaps = Math.max(currentLap + 10, 70);
    }

    var racePct = currentLap > 0 ? Math.round((currentLap / totalLaps) * 100) : 0;

    var driverLines = top10.map(function (r) {
      return "P" + r.position + " " + r.code +
        " (gap=" + r.gap +
        ", tyre=" + (r.tyreClass || "?").toUpperCase() +
        ", pits=" + r.pits + ")";
    });

    var prompt = "Formula 1 race, approximately " + racePct + "% complete (lap " +
      currentLap + " of ~" + totalLaps + "). Current standings:\n" +
      driverLines.join(", ") + "\n\n" +
      "Based on current gaps, tyre compounds, and pit stop counts, predict the top 3 finishers " +
      "and give one specific reason for each prediction. Format as: " +
      "P1: [DRIVER CODE] because [reason]. P2: [DRIVER CODE] because [reason]. P3: [DRIVER CODE] because [reason].";

    HuggingFaceAPI.generate(prompt, 200)
      .done(function (resp) {
        var text = extractGeneratedText(resp);
        setResult("aiPrediction", "Race Outcome Prediction", text);
      })
      .fail(function (err) {
        setError("aiPrediction", err);
      });
  }

  /* ===== Refresh All =====
     Called by dashboardPage.js every 3 minutes and on manual Refresh click.
  ===== */
  function refreshAll(towerRows, raceControlRows, currentLap) {
    if (!HuggingFaceAPI.hasToken()) {
      showNoToken();
      return;
    }

    showHasToken();

    generateCommentary(raceControlRows);
    analyzePerformance(towerRows);
    predictOutcome(towerRows, currentLap);
  }

  /* ===== Reset panel to default state ===== */
  function reset() {
    var defaultMsg = '<p class="muted">Select a session to generate AI insights.</p>';
    $("#aiCommentary").html(defaultMsg);
    $("#aiPerformance").html(defaultMsg);
    $("#aiPrediction").html(defaultMsg);
  }

  /* ===== Check token on page load ===== */
  function checkToken() {
    if (HuggingFaceAPI.hasToken()) {
      showHasToken();
    } else {
      showNoToken();
    }
  }

  /* ===== Helpers ===== */
  function extractGeneratedText(resp) {
    if (!resp) return "";
    if (typeof resp === "string") return resp;
    if (Array.isArray(resp)) {
      var first = resp[0] || {};
      return first.generated_text || first.summary_text || first.translation_text || "";
    }
    return resp.generated_text || resp.summary_text || "";
  }

  return {
    generateCommentary: generateCommentary,
    analyzePerformance: analyzePerformance,
    predictOutcome:     predictOutcome,
    refreshAll:         refreshAll,
    reset:              reset,
    checkToken:         checkToken
  };
})();
