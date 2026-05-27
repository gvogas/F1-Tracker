import { NextResponse } from "next/server";
import { cacheGet, cacheKey, cachePeek, cacheSet, TTL } from "@/lib/cache";
import { fetchCachedSafe } from "@/lib/server/streams";
import { assembleTower } from "@/lib/f1/assembleTower";
import {
  carDataWindow,
  intervalsWindow,
  lapsWindow,
  positionWindow,
} from "@/lib/f1/windows";
import type { TowerRow } from "@/types/f1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  const date = searchParams.get("date"); // ISO string for replay, absent for live
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }

  const towerKey = cacheKey("tower", { session_key: sessionKey, date: date ?? "live" });
  const cached = cacheGet<TowerRow[]>(towerKey);
  if (cached !== null) return NextResponse.json(cached);

  const lastKey = cacheKey("tower_last", { session_key: sessionKey });
  const sk = { session_key: sessionKey };

  const [positions, intervals, laps, stints, pits, drivers, carData] = await Promise.all([
    fetchCachedSafe("position", { ...sk, ...positionWindow(date) }, TTL.position),
    fetchCachedSafe("intervals", { ...sk, ...intervalsWindow(date) }, TTL.intervals),
    fetchCachedSafe("laps", { ...sk, ...lapsWindow(date) }, TTL.laps),
    fetchCachedSafe("stints", sk, TTL.stints),
    fetchCachedSafe("pit", sk, TTL.pit),
    fetchCachedSafe("drivers", sk, TTL.drivers),
    fetchCachedSafe("car_data", { ...sk, ...carDataWindow(date) }, TTL.car_data),
  ]);

  const rows = assembleTower({ positions, intervals, laps, stints, pits, drivers, carData });

  if (rows.length === 0) {
    // Graceful degradation: serve the last good snapshot rather than an empty board.
    const last = cachePeek<TowerRow[]>(lastKey);
    return NextResponse.json(last ?? []);
  }

  cacheSet(towerKey, rows, TTL.tower);
  cacheSet(lastKey, rows, TTL.tower_last);
  return NextResponse.json(rows);
}
