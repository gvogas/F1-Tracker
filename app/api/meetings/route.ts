import { NextResponse } from "next/server";
import { TTL } from "@/lib/cache";
import { fetchCached } from "@/lib/server/streams";
import { normalizeMeetings } from "@/lib/f1/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ?? String(new Date().getFullYear());
  try {
    const raw = await fetchCached("meetings", { year }, TTL.meetings);
    return NextResponse.json(normalizeMeetings(raw));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
