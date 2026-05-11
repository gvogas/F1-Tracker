/**
 * F1 Tracker — HuggingFace AI Proxy (Cloudflare Worker)
 *
 * Deploy steps:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. cd worker && wrangler deploy
 *   4. wrangler secret put HF_TOKEN   (paste your HF token when prompted)
 *   5. Copy your Worker URL into Profile → AI Proxy URL
 *
 * Local dev:
 *   Create worker/.dev.vars with: HF_TOKEN=hf_xxxxxxx
 *   Then: wrangler dev
 */

const ALLOWED_MODELS = [
  "facebook/bart-large-cnn",
  "google/flan-t5-base"
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // Health check — lets the dashboard know the proxy is live
    if (url.pathname === "/health") {
      const ok = Boolean(env.HF_TOKEN);
      return Response.json(
        { ok, msg: ok ? "ready" : "HF_TOKEN secret not set" },
        { status: ok ? 200 : 503, headers: CORS }
      );
    }

    if (url.pathname !== "/infer" || request.method !== "POST") {
      return new Response("Not found", { status: 404, headers: CORS });
    }

    const model = url.searchParams.get("model");
    if (!model || !ALLOWED_MODELS.includes(model)) {
      return Response.json(
        { error: "Unknown or disallowed model: " + (model || "(none)") },
        { status: 400, headers: CORS }
      );
    }

    if (!env.HF_TOKEN) {
      return Response.json(
        { error: "HF_TOKEN secret not configured on this Worker. Run: wrangler secret put HF_TOKEN" },
        { status: 503, headers: CORS }
      );
    }

    let body;
    try { body = await request.text(); } catch (_) { body = "{}"; }

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/" + model,
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.HF_TOKEN,
          "Content-Type": "application/json"
        },
        body
      }
    );

    const responseText = await hfRes.text();

    return new Response(responseText, {
      status: hfRes.status,
      headers: {
        ...CORS,
        "Content-Type": hfRes.headers.get("Content-Type") || "application/json"
      }
    });
  }
};
