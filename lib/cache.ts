import { createHash } from "node:crypto";

interface Entry {
  expiresAt: number;
  payload: unknown;
}

// A single Map shared across all route modules + dev HMR reloads.
const store: Map<string, Entry> = (() => {
  const g = globalThis as unknown as { __f1cache?: Map<string, Entry> };
  if (!g.__f1cache) g.__f1cache = new Map();
  return g.__f1cache;
})();

/** Per-endpoint TTLs in seconds (mirrors the legacy PHP app). */
export const TTL = {
  meetings: 3600,
  sessions: 3600,
  drivers: 3600,
  results: 3600,
  weather: 30,
  position: 10,
  intervals: 10,
  laps: 5,
  stints: 60,
  pit: 60,
  car_data: 5,
  location: 3,
  race_control: 10,
  tower: 5,
  tower_last: 120,
  "track-outline": 3600,
  ai_commentator: 30,
} as const;

export function cacheKey(endpoint: string, params: Record<string, unknown> = {}): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join("&");
  return createHash("md5").update(`${endpoint}:${sorted}`).digest("hex");
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.payload as T;
}

/** Read without honouring expiry — used for graceful "last good" fallbacks. */
export function cachePeek<T>(key: string): T | null {
  const entry = store.get(key);
  return entry ? (entry.payload as T) : null;
}

export function cacheSet<T>(key: string, payload: T, ttlSec: number): void {
  store.set(key, { expiresAt: Date.now() + ttlSec * 1000, payload });
}

export async function remember<T>(
  key: string,
  ttlSec: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await producer();
  cacheSet(key, value, ttlSec);
  return value;
}
