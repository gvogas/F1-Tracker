/* ===================================================================
   HuggingFace AI Proxy — client-side wrapper

   The HF token is NEVER stored in the browser. Instead, users deploy
   a Cloudflare Worker (see /worker/) that holds the token as a secret.
   The browser only stores the proxy URL (not sensitive).

   Proxy URL is stored in UserPrefsModel as `aiProxyUrl`.
=================================================================== */
var HuggingFaceAPI = {

  /* ===== Proxy URL helpers ===== */
  getProxyUrl: function () {
    if (typeof UserPrefsModel === "undefined" || !UserPrefsModel.load) return "";
    var prefs = UserPrefsModel.load();
    return (prefs.aiProxyUrl || "").trim().replace(/\/$/, "");
  },

  hasToken: function () {
    return HuggingFaceAPI.getProxyUrl().length > 0;
  },

  /* ===== Core inference call =====
     POSTs to the proxy worker at /infer?model=xxx.
     The proxy adds the HF Bearer token server-side — the browser never
     sees or sends the token.
     Returns a jQuery Deferred promise.
  ===== */
  infer: function (model, inputs, parameters) {
    var proxyUrl = HuggingFaceAPI.getProxyUrl();

    if (!proxyUrl) {
      return $.Deferred().reject("No AI proxy URL set. Add yours in Profile.").promise();
    }

    if (!inputs || (typeof inputs === "string" && inputs.trim().length === 0)) {
      return $.Deferred().reject("No input data to analyze yet.").promise();
    }

    var d = $.Deferred();

    $.ajax({
      url: proxyUrl + "/infer?model=" + encodeURIComponent(model),
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        inputs: inputs,
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

      if (status === 400) {
        msg = "Proxy rejected the request (bad model or input).";
      } else if (status === 429) {
        msg = "HuggingFace rate limit reached. Try again in a moment.";
      } else if (status === 503) {
        msg = "HuggingFace model is loading — try again in 20-30 seconds.";
      } else if (!status) {
        msg = "Could not reach the AI proxy. Check the URL in Profile.";
      } else {
        var body = {};
        try { body = JSON.parse(xhr.responseText); } catch (e) {}
        msg = (body && body.error) ? body.error : ("Proxy error (HTTP " + status + ")");
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
     Model:    google/flan-t5-base
  ===== */
  generate: function (prompt, maxNewTokens) {
    return HuggingFaceAPI.infer(
      "google/flan-t5-base",
      prompt,
      {
        max_new_tokens: maxNewTokens || 220,
        temperature: 0.6,
        do_sample: false
      }
    );
  }
};
