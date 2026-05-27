import type { Compound } from "@/types/f1";

/** Format a gap/interval: null/empty -> "—", 0 -> "Leader", else "+X.XXX". */
export function fmtGap(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") {
    // OpenF1 sometimes returns lap-based strings like "+1 LAP".
    if (/lap/i.test(value)) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return n === 0 ? "Leader" : `+${Math.abs(n).toFixed(3)}`;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n === 0 ? "Leader" : `+${Math.abs(n).toFixed(3)}`;
}

/** Seconds -> "M:SS.mmm". Non-positive/invalid -> "—". */
export function fmtLapTime(seconds: unknown): string {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? "0" : ""}${rest.toFixed(3)}`;
}

const COMPOUND_MAP: Record<string, Compound> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};

export function normalizeCompound(raw: unknown): Compound {
  const s = String(raw ?? "").toUpperCase().trim();
  if (!s) return "?";
  if (COMPOUND_MAP[s]) return COMPOUND_MAP[s];
  const first = s[0];
  if (first === "S" || first === "M" || first === "H" || first === "I" || first === "W") {
    return first as Compound;
  }
  return "?";
}

/**
 * Collapse a time-series array to the latest record per driver by string-comparing
 * the ISO `date` field (lexicographic compare is correct for ISO-8601 timestamps).
 */
export function latestByDriver<T extends Record<string, unknown>>(
  items: T[],
  numField = "driver_number",
): Map<number, T> {
  const latest = new Map<number, T>();
  for (const item of items) {
    const num = Number(item[numField] ?? 0);
    if (num <= 0) continue;
    const date = String(item.date ?? "");
    const prev = latest.get(num);
    if (!prev || date > String(prev.date ?? "")) {
      latest.set(num, item);
    }
  }
  return latest;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function windCompass(deg: unknown): string {
  const d = Number(deg);
  if (!Number.isFinite(d)) return "—";
  return COMPASS[Math.round(d / 22.5) % 16];
}
