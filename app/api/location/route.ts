import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCachedSafe } from "@/lib/server/streams";
import { locationWindow } from "@/lib/f1/windows";
import type { LocationPoint } from "@/types/f1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  const date = searchParams.get("date");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }

  const raw = await fetchCachedSafe(
    "location",
    { session_key: sessionKey, ...locationWindow(date) },
    TTL.location,
  );

  const points: LocationPoint[] = raw
    .map((r) => ({
      driverNumber: Number(r.driver_number) || 0,
      x: num(r.x),
      y: num(r.y),
      date: String(r.date ?? ""),
    }))
    .filter((p) => p.driverNumber > 0 && Number.isFinite(p.x) && Number.isFinite(p.y));

  return NextResponse.json(points);
}
