import type { SessionModel } from "@/types/f1";

const PRIORITY: Record<string, number> = {
  "Practice 1": 1,
  "Practice 2": 2,
  "Practice 3": 3,
  Qualifying: 4,
  "Sprint Qualifying": 5,
  "Sprint Shootout": 5,
  Sprint: 5,
  Race: 6,
};

function priorityOf(s: SessionModel): number {
  return PRIORITY[s.name] ?? 0;
}

/** Pick the most "headline" session of a meeting (Race > Sprint > Quali > Practice). */
export function pickBestSession(sessions: SessionModel[]): SessionModel | null {
  if (!sessions.length) return null;
  return [...sessions].sort((a, b) => priorityOf(b) - priorityOf(a))[0];
}
