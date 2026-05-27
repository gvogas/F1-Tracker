import type { Compound } from "@/types/f1";

export const TYRE_COLOR: Record<Compound, string> = {
  S: "#ef4444",
  M: "#eab308",
  H: "#e5e7eb",
  I: "#22c55e",
  W: "#3b82f6",
  "?": "#71717a",
};

export type DrsState = "on" | "eligible" | "off";

export function drsState(drs: number): DrsState {
  if (drs === 10 || drs === 12 || drs === 14) return "on";
  if (drs === 8) return "eligible";
  return "off";
}

export function sectorPercents(s1: number, s2: number, s3: number) {
  const total = s1 + s2 + s3;
  if (total <= 0) return { s1p: 0, s2p: 0, s3p: 0 };
  return {
    s1p: (s1 / total) * 100,
    s2p: (s2 / total) * 100,
    s3p: (s3 / total) * 100,
  };
}

/** Team colour as a usable CSS hex, with a sensible fallback. */
export function teamHex(teamColour: string): string {
  const c = (teamColour || "").replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(c) ? `#${c}` : "#9ca3af";
}

export function hexToRgba(hex: string, alpha: number): string {
  const c = (hex || "").replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return `rgba(225,6,0,${alpha})`;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
