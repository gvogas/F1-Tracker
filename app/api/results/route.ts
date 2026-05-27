import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCached } from "@/lib/server/streams";
import { normalizeDrivers } from "@/lib/f1/normalize";
import type { ResultRow } from "@/types/f1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const [rawDrivers, rawResults] = await Promise.all([
      fetchCached("drivers", { session_key: sessionKey }, TTL.drivers),
      fetchCached("session_result", { session_key: sessionKey }, TTL.results),
    ]);
    const drivers = normalizeDrivers(rawDrivers);
    const drvMap = new Map(drivers.map((d) => [d.number, d]));

    const rows: ResultRow[] = rawResults
      .map((r) => {
        const n = num(r.driver_number);
        return {
          position: num(r.position),
          driver: drvMap.get(n) ?? null,
          points: num(r.points),
          laps: num(r.number_of_laps),
          status: String(r.status ?? ""),
          dnf: Boolean(r.dnf),
          dns: Boolean(r.dns),
          dsq: Boolean(r.dsq),
        };
      })
      .filter((r): r is ResultRow => r.driver !== null)
      .sort((a, b) => (a.position || 99) - (b.position || 99));

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
