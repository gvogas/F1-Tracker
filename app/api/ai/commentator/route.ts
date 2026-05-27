import { NextResponse } from "next/server";
import { cacheGet, cacheKey, cacheSet, TTL } from "@/lib/cache";
import { fetchCachedSafe } from "@/lib/server/streams";
import { assembleTower } from "@/lib/f1/assembleTower";
import {
  carDataWindow,
  intervalsWindow,
  lapsWindow,
  positionWindow,
} from "@/lib/f1/windows";
import {
  buildTowerText,
  generateCommentary,
  type CommentaryResult,
} from "@/lib/ai/commentator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let sessionKey = "";
  let date: string | null = null;
  try {
    const body = (await req.json()) as { session_key?: string | number; date?: string };
    sessionKey = String(body.session_key ?? "");
    date = body.date ?? null;
  } catch {
    /* ignore malformed body */
  }
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }

  const key = cacheKey("ai_commentator", { session_key: sessionKey, date: date ?? "live" });
  const cached = cacheGet<CommentaryResult>(key);
  if (cached !== null) {
    return NextResponse.json({ commentary: cached.text, ai: cached.ai });
  }

  const sk = { session_key: sessionKey };
  const [positions, intervals, laps, stints, pits, drivers, carData, rc] = await Promise.all([
    fetchCachedSafe("position", { ...sk, ...positionWindow(date) }, TTL.position),
    fetchCachedSafe("intervals", { ...sk, ...intervalsWindow(date) }, TTL.intervals),
    fetchCachedSafe("laps", { ...sk, ...lapsWindow(date) }, TTL.laps),
    fetchCachedSafe("stints", sk, TTL.stints),
    fetchCachedSafe("pit", sk, TTL.pit),
    fetchCachedSafe("drivers", sk, TTL.drivers),
    fetchCachedSafe("car_data", { ...sk, ...carDataWindow(date) }, TTL.car_data),
    fetchCachedSafe("race_control", sk, TTL.race_control),
  ]);

  const rows = assembleTower({ positions, intervals, laps, stints, pits, drivers, carData });
  const towerText = buildTowerText(rows);
  const lastRc = rc.length ? String(rc[rc.length - 1].message ?? "") : "";

  const result = await generateCommentary(towerText, lastRc);
  cacheSet(key, result, TTL.ai_commentator);
  return NextResponse.json({ commentary: result.text, ai: result.ai });
}
