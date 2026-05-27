import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCached } from "@/lib/server/streams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key required" }, { status: 400 });
  }
  try {
    const raw = await fetchCached("race_control", { session_key: sessionKey }, TTL.race_control);
    return NextResponse.json(raw);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
