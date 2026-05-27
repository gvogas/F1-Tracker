export type QueryValue = string | number | string[];
export type QueryParams = Record<string, QueryValue>;

const BASE_URL = process.env.OPENF1_BASE_URL ?? "https://api.openf1.org/v1";
const RETRY_DELAYS = [0, 2, 4, 8]; // seconds before each retry attempt
const TIMEOUT_MS = 15000;

/**
 * Build an OpenF1 query string. Values may carry a comparison operator prefix
 * (<=, >=, <, >) which must be preserved literally while the key and the
 * remaining value are URL-encoded — e.g. { date: ">=2024-01-01T00:00:00Z" }.
 * An array value expands to repeated params, e.g. { date: [">=A", "<=B"] }.
 */
export function buildQuery(params: QueryParams): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    const values = Array.isArray(val) ? val : [val];
    for (const raw of values) {
      const v = String(raw);
      const m = /^(<=|>=|<|>)(.*)$/s.exec(v);
      if (m) {
        parts.push(`${encodeURIComponent(key)}${m[1]}${encodeURIComponent(m[2])}`);
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
      }
    }
  }
  return parts.join("&");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET an OpenF1 endpoint and return its JSON array. Retries on HTTP 429 with
 * Retry-After awareness and an exponential fallback schedule; throws on other
 * 4xx/5xx and after exhausting retries.
 */
export async function openf1Get<T = unknown>(
  endpoint: string,
  params: QueryParams = {},
): Promise<T[]> {
  const qs = buildQuery(params);
  const url = `${BASE_URL}/${endpoint}${qs ? `?${qs}` : ""}`;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const delay = RETRY_DELAYS[attempt] ?? 0;
    if (delay > 0) await sleep(delay * 1000);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
        cache: "no-store",
      });
    } catch (err) {
      clearTimeout(timer);
      if (attempt < RETRY_DELAYS.length - 1) {
        attempt++;
        continue;
      }
      throw err;
    }
    clearTimeout(timer);

    if (res.status === 429) {
      if (attempt < RETRY_DELAYS.length - 1) {
        const ra = parseInt(res.headers.get("retry-after") ?? "0", 10);
        if (ra > 0) RETRY_DELAYS[attempt + 1] = Math.min(ra, 30);
        attempt++;
        continue;
      }
      throw new Error(`OpenF1 429 (rate limited): ${endpoint}`);
    }

    if (!res.ok) {
      throw new Error(`OpenF1 ${res.status} for ${endpoint}`);
    }

    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as T[]) : [];
  }
}
