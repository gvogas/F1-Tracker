import { cacheGet, cacheKey, cachePeek, cacheSet, remember } from "@/lib/cache";
import { openf1Get, type QueryParams } from "@/lib/openf1/client";

type Raw = Record<string, unknown>;

/** Cached OpenF1 fetch. Throws on failure (no stale fallback). */
export function fetchCached(endpoint: string, params: QueryParams, ttl: number): Promise<Raw[]> {
  const key = cacheKey(endpoint, params);
  return remember(key, ttl, () => openf1Get<Raw>(endpoint, params));
}

/**
 * Cached OpenF1 fetch that never throws: on upstream failure it serves the last
 * cached value (even if expired) or an empty array. Used for the tower's
 * graceful degradation.
 */
export async function fetchCachedSafe(
  endpoint: string,
  params: QueryParams,
  ttl: number,
): Promise<Raw[]> {
  const key = cacheKey(endpoint, params);
  const fresh = cacheGet<Raw[]>(key);
  if (fresh !== null) return fresh;
  try {
    const value = await openf1Get<Raw>(endpoint, params);
    cacheSet(key, value, ttl);
    return value;
  } catch {
    return cachePeek<Raw[]>(key) ?? [];
  }
}
