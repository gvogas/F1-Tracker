import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCached } from "@/lib/server/streams";
import { normalizeSessions } from "@/lib/f1/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const meetingKey = searchParams.get("meeting_key");
  if (!meetingKey) {
    return NextResponse.json({ error: "meeting_key required" }, { status: 400 });
  }
  try {
    const raw = await fetchCached("sessions", { meeting_key: meetingKey }, TTL.sessions);
    return NextResponse.json(normalizeSessions(raw));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
