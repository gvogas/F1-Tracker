"use client";

const TIMEOUT_MS = 15000;
const BASE_BACKOFF_MS = 8000;
const MAX_BACKOFF_MS = 120000;

let backoffUntil = 0;
let lastBackoffAt = 0;
let streak = 0;

function noteSuccess() {
  // Reset the streak after sustained success.
  if (streak > 0 && Date.now() - backoffUntil > 15000) streak = 0;
}

function noteThrottle(retryAfterMs: number) {
  const now = Date.now();
  streak = now - lastBackoffAt < 60000 ? Math.min(streak + 1, 5) : 1;
  lastBackoffAt = now;
  const base = retryAfterMs > 0 ? retryAfterMs : BASE_BACKOFF_MS;
  let wait = Math.min(base * Math.pow(2, streak - 1), MAX_BACKOFF_MS);
  wait += Math.random() * Math.min(wait * 0.25, 2000); // jitter
  backoffUntil = now + wait;
}

export function isBackingOff(): boolean {
  return Date.now() < backoffUntil;
}

/** Same-origin JSON GET/POST with timeout and shared 429/503 backoff. */
export async function apiFetch<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  if (isBackingOff()) {
    throw new Error("backoff");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    if (res.status === 429 || res.status === 503) {
      const ra = parseInt(res.headers.get("retry-after") ?? "0", 10);
      noteThrottle(ra > 0 ? ra * 1000 : 0);
      throw new Error(`throttled ${res.status}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    noteSuccess();
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
