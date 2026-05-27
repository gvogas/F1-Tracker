import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCached } from "@/lib/server/streams";
import { normalizeDrivers } from "@/lib/f1/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const raw = await fetchCached("drivers", { session_key: sessionKey }, TTL.drivers);
    return NextResponse.json(normalizeDrivers(raw));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
