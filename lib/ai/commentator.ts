import type { Compound, TowerRow } from "@/types/f1";

export interface CommentaryResult {
  text: string;
  /** true when produced by a real model, false for the graceful placeholder */
  ai: boolean;
}

const COMPOUND_WORD: Record<Compound, string> = {
  S: "SOFT",
  M: "MEDIUM",
  H: "HARD",
  I: "INTER",
  W: "WET",
  "?": "—",
};

const PLACEHOLDER =
  "Live AI commentary is offline — set HF_TOKEN to enable it. The timing tower and track map are running on live OpenF1 data.";

/** Render the top of the field into the compact text the model reads. */
export function buildTowerText(rows: TowerRow[], limit = 12): string {
  return rows
    .slice(0, limit)
    .map(
      (r) =>
        `P${r.position} ${r.driver.acronym}: gap=${r.gap}, tyre=${COMPOUND_WORD[r.compound]}, last=${r.lastLap}`,
    )
    .join("\n");
}

function buildPrompt(towerText: string, raceControl: string): string {
  return [
    "You are an enthusiastic Formula 1 TV commentator. Based on the following live timing data,",
    "provide 2-4 sentences of exciting live race commentary. Use driver surnames and team names.",
    "Be dramatic but accurate.",
    "",
    "Current timing tower:",
    towerText || "(no timing data yet)",
    "",
    `Latest race control: ${raceControl || "No race control messages."}`,
    "",
    "Commentary:",
  ].join("\n");
}

const TIMEOUT_MS = 20000;

async function postJSON(url: string, token: string, body: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`AI provider ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function generateCommentary(
  towerText: string,
  raceControl: string,
): Promise<CommentaryResult> {
  const provider = process.env.AI_PROVIDER ?? "huggingface-router";
  const model = process.env.AI_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.3";
  const token = process.env.HF_TOKEN ?? "";

  if (provider === "none" || !token) {
    return { text: PLACEHOLDER, ai: false };
  }

  const prompt = buildPrompt(towerText, raceControl);

  try {
    if (provider === "huggingface-legacy") {
      const url = `https://api-inference.huggingface.co/models/${model}`;
      const raw = (await postJSON(url, token, {
        inputs: prompt,
        parameters: { max_new_tokens: 200, temperature: 0.7, return_full_text: false },
      })) as Array<{ generated_text?: string }> | { generated_text?: string };
      const text = Array.isArray(raw)
        ? raw[0]?.generated_text ?? ""
        : raw.generated_text ?? "";
      return text.trim()
        ? { text: text.trim(), ai: true }
        : { text: PLACEHOLDER, ai: false };
    }

    // Default: HF Inference Providers router (OpenAI-style chat completions).
    const url = process.env.AI_ROUTER_URL ?? "https://router.huggingface.co/v1/chat/completions";
    const raw = (await postJSON(url, token, {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    })) as { choices?: Array<{ message?: { content?: string } }> };
    const text = raw.choices?.[0]?.message?.content?.trim() ?? "";
    return text ? { text, ai: true } : { text: PLACEHOLDER, ai: false };
  } catch {
    return { text: PLACEHOLDER, ai: false };
  }
}
