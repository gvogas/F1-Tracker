import type { QueryParams } from "@/lib/openf1/client";

const iso = (ms: number): string => new Date(ms).toISOString();

function anchorOf(dateIso?: string | null): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Time-window for a per-driver telemetry stream (position / intervals / laps /
 * car_data / location). Live (no date) → everything since `now - backSecs`.
 * Replay (date given) → the closed window `[anchor - backSecs, anchor]`.
 */
function streamWindow(dateIso: string | null | undefined, backSecs: number): QueryParams {
  const anchor = anchorOf(dateIso);
  if (anchor === null) {
    return { date: `>=${iso(Date.now() - backSecs * 1000)}` };
  }
  return { date: [`>=${iso(anchor - backSecs * 1000)}`, `<=${iso(anchor)}`] };
}

export const positionWindow = (d?: string | null) => streamWindow(d, 4);
export const intervalsWindow = (d?: string | null) => streamWindow(d, 4);
// Laps emit once per completed lap — widen so the latest lap per driver is captured.
export const lapsWindow = (d?: string | null) => streamWindow(d, 600);
export const carDataWindow = (d?: string | null) => streamWindow(d, 5);
export const locationWindow = (d?: string | null) => streamWindow(d, 4);

/**
 * Track-outline window. Live → last 180s of motion. Replay → biased forward
 * `[anchor - 30s, anchor + 270s]` so even an early-session anchor traces a full
 * circuit lap.
 */
export function outlineWindow(dateIso?: string | null): QueryParams {
  const anchor = anchorOf(dateIso);
  if (anchor === null) {
    return { date: `>=${iso(Date.now() - 180 * 1000)}` };
  }
  return { date: [`>=${iso(anchor - 30 * 1000)}`, `<=${iso(anchor + 270 * 1000)}`] };
}
