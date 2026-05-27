import { NextResponse } from "next/server";
import { cacheKey, cacheGet, cacheSet, TTL } from "@/lib/cache";
import { fetchCached, fetchCachedSafe } from "@/lib/server/streams";
import { outlineWindow } from "@/lib/f1/windows";
import type { TrackPoint } from "@/types/f1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_POINTS = 150;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  const date = searchParams.get("date");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }

  const outKey = cacheKey("track-outline", { session_key: sessionKey, date: date ?? "live" });
  const cached = cacheGet<TrackPoint[]>(outKey);
  if (cached !== null) return NextResponse.json(cached);

  try {
    // Trace the circuit from a single car's GPS samples.
    const drivers = await fetchCached("drivers", { session_key: sessionKey }, TTL.drivers);
    const driverNumber = Number(drivers[0]?.driver_number) || 1;

    const raw = await fetchCachedSafe(
      "location",
      { session_key: sessionKey, driver_number: String(driverNumber), ...outlineWindow(date) },
      TTL.location,
    );

    const sorted = [...raw].sort((a, b) =>
      String(a.date ?? "").localeCompare(String(b.date ?? "")),
    );
    const step = Math.max(1, Math.floor(sorted.length / MAX_POINTS));

    const points: TrackPoint[] = [];
    for (let i = 0; i < sorted.length; i += step) {
      const x = Number(sorted[i].x);
      const y = Number(sorted[i].y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x === 0 && y === 0) continue;
      points.push({ x, y });
    }

    cacheSet(outKey, points, TTL["track-outline"]);
    return NextResponse.json(points);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
