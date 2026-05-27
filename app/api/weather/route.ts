import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCached } from "@/lib/server/streams";
import { latestWeather } from "@/lib/f1/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const raw = await fetchCached("weather", { session_key: sessionKey }, TTL.weather);
    return NextResponse.json(latestWeather(raw));
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
