/* ===================================================================
   HuggingFace Inference API — client-side wrapper
   Token is read from UserPrefsModel (stored in browser cookies only).
   Never hardcode the token in this file.
=================================================================== */
var HuggingFaceAPI = {

  BASE: "https://api-inference.huggingface.co/models",

  /* ===== Token helpers ===== */
  getToken: function () {
    if (typeof UserPrefsModel === "undefined" || !UserPrefsModel.load) return "";
    var prefs = UserPrefsModel.load();
    return (prefs.hfToken || "").trim();
  },

  hasToken: function () {
    return HuggingFaceAPI.getToken().length > 0;
  },

  /* ===== Core inference call =====
     Returns a jQuery Deferred promise.
     Resolves with the raw JSON response array/object from HF.
     Rejects with a friendly error message string.
  ===== */
  infer: function (model, inputs, parameters) {
    var token = HuggingFaceAPI.getToken();

    if (!token) {
      return $.Deferred().reject("No HuggingFace token set. Add yours in Profile.").promise();
    }

    if (!inputs || (typeof inputs === "string" && inputs.trim().length === 0)) {
      return $.Deferred().reject("No input data to analyze yet.").promise();
    }

    var d = $.Deferred();

    $.ajax({
      url:  HuggingFaceAPI.BASE + "/" + model,
      method: "POST",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      data: JSON.stringify({
        inputs:  inputs,
        parameters: parameters || {},
        options: { wait_for_model: true }
      }),
      timeout: 35000
    })
    .done(function (resp) {
      d.resolve(resp);
    })
    .fail(function (xhr) {
      var status = xhr && xhr.status;
      var msg;

      if (status === 401 || status === 403) {
        msg = "Invalid HuggingFace token. Check your token in Profile.";
      } else if (status === 429) {
        msg = "HuggingFace rate limit reached. Try again in a moment.";
      } else if (status === 503) {
        msg = "HuggingFace model is loading — please try again in 30 seconds.";
      } else if (!status) {
        msg = "Network error reaching HuggingFace. Check your connection.";
      } else {
        var body = "";
        try { body = JSON.parse(xhr.responseText); } catch (e) {}
        msg = (body && body.error) ? body.error : ("HuggingFace error (HTTP " + status + ")");
      }

      console.warn("[HuggingFaceAPI] " + msg);
      d.reject(msg);
    });

    return d.promise();
  },

  /* ===== Summarization =====
     Best for: race control message summarization
     Model:    facebook/bart-large-cnn
  ===== */
  summarize: function (text, maxLen) {
    return HuggingFaceAPI.infer(
      "facebook/bart-large-cnn",
      text,
      {
        max_length: maxLen || 130,
        min_length: 25,
        do_sample: false
      }
    );
  },

  /* ===== Text generation =====
     Best for: performance analysis and race prediction
     Model:    google/flan-t5-base  (fast, instruction-following, free tier)
  ===== */
  generate: function (prompt, maxNewTokens) {
    return HuggingFaceAPI.infer(
      "google/flan-t5-base",
      prompt,
      {
        max_new_tokens: maxNewTokens || 220,
        temperature: 0.6,
        do_sample: false   // deterministic for F1 analysis
      }
    );
  }
};
