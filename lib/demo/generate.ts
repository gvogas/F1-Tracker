/**
 * Synthetic OpenF1-shaped data for offline demos (gated by DEMO_DATA=1).
 * It mirrors the raw field names the real normalizers/assembler expect, so the
 * entire production pipeline (windowing, latestByDriver, assembleTower, the
 * canvas track map) runs unchanged on fabricated data.
 */
import type { QueryParams } from "@/lib/openf1/client";

const DEMO_START_MS = Date.parse("2024-11-03T17:00:00Z");
const SESSION_END_MS = DEMO_START_MS + 2 * 60 * 60 * 1000;
const LAP_SECONDS = 75;

interface Drv {
  num: number;
  first: string;
  last: string;
  acr: string;
  team: string;
  colour: string;
  cc: string;
}

const DRIVERS: Drv[] = [
  { num: 1, first: "Max", last: "Verstappen", acr: "VER", team: "Red Bull Racing", colour: "3671C6", cc: "NED" },
  { num: 11, first: "Sergio", last: "Perez", acr: "PER", team: "Red Bull Racing", colour: "3671C6", cc: "MEX" },
  { num: 16, first: "Charles", last: "Leclerc", acr: "LEC", team: "Ferrari", colour: "E80020", cc: "MON" },
  { num: 55, first: "Carlos", last: "Sainz", acr: "SAI", team: "Ferrari", colour: "E80020", cc: "ESP" },
  { num: 44, first: "Lewis", last: "Hamilton", acr: "HAM", team: "Mercedes", colour: "27F4D2", cc: "GBR" },
  { num: 63, first: "George", last: "Russell", acr: "RUS", team: "Mercedes", colour: "27F4D2", cc: "GBR" },
  { num: 4, first: "Lando", last: "Norris", acr: "NOR", team: "McLaren", colour: "FF8000", cc: "GBR" },
  { num: 81, first: "Oscar", last: "Piastri", acr: "PIA", team: "McLaren", colour: "FF8000", cc: "AUS" },
  { num: 14, first: "Fernando", last: "Alonso", acr: "ALO", team: "Aston Martin", colour: "229971", cc: "ESP" },
  { num: 18, first: "Lance", last: "Stroll", acr: "STR", team: "Aston Martin", colour: "229971", cc: "CAN" },
  { num: 10, first: "Pierre", last: "Gasly", acr: "GAS", team: "Alpine", colour: "0093CC", cc: "FRA" },
  { num: 31, first: "Esteban", last: "Ocon", acr: "OCO", team: "Alpine", colour: "0093CC", cc: "FRA" },
  { num: 23, first: "Alex", last: "Albon", acr: "ALB", team: "Williams", colour: "64C4FF", cc: "THA" },
  { num: 2, first: "Logan", last: "Sargeant", acr: "SAR", team: "Williams", colour: "64C4FF", cc: "USA" },
  { num: 22, first: "Yuki", last: "Tsunoda", acr: "TSU", team: "RB", colour: "6692FF", cc: "JPN" },
  { num: 3, first: "Daniel", last: "Ricciardo", acr: "RIC", team: "RB", colour: "6692FF", cc: "AUS" },
  { num: 77, first: "Valtteri", last: "Bottas", acr: "BOT", team: "Kick Sauber", colour: "52E252", cc: "FIN" },
  { num: 24, first: "Zhou", last: "Guanyu", acr: "ZHO", team: "Kick Sauber", colour: "52E252", cc: "CHN" },
  { num: 20, first: "Kevin", last: "Magnussen", acr: "MAG", team: "Haas F1 Team", colour: "B6BABD", cc: "DEN" },
  { num: 27, first: "Nico", last: "Hulkenberg", acr: "HUL", team: "Haas F1 Team", colour: "B6BABD", cc: "GER" },
];

const COMPOUNDS = ["SOFT", "MEDIUM", "HARD"];

function isoOf(ms: number): string {
  return new Date(ms).toISOString();
}

/** Find the replay anchor (upper time bound), or "now" for a live window. */
function anchorMs(params: QueryParams): number {
  const d = params.date;
  if (Array.isArray(d)) {
    const upper = d.find((s) => s.startsWith("<="));
    if (upper) {
      const t = Date.parse(upper.slice(2));
      if (Number.isFinite(t)) return t;
    }
    const lower = d.find((s) => s.startsWith(">="));
    if (lower) {
      const t = Date.parse(lower.slice(2));
      if (Number.isFinite(t)) return t + 4000;
    }
  }
  return Date.now();
}

/** Distance covered (in laps) by driver index i at sim-elapsed seconds t. */
function distance(i: number, t: number): number {
  const delta = (10 - i) * 0.0015; // grid-ish pace spread
  const amp = 0.06 + (i % 5) * 0.02;
  const period = 45 + (i % 7) * 6;
  const phase = i * 1.3;
  return (t / LAP_SECONDS) * (1 + delta) + amp * Math.sin(t / period + phase);
}

/** Closed parametric circuit; u in [0,1). */
function circuitXY(u: number): { x: number; y: number } {
  const a = 2 * Math.PI * u;
  const x = Math.cos(a) + 0.45 * Math.cos(2 * a);
  const y = Math.sin(a) - 0.35 * Math.sin(2 * a) + 0.12 * Math.sin(a);
  return { x: Math.round(x * 1000), y: Math.round(y * 1000) };
}

/** Drivers ranked by distance at time t -> [{ drv, idx, d, position }]. */
function ranking(t: number) {
  const elapsed = Math.max(0, t - DEMO_START_MS) / 1000;
  const arr = DRIVERS.map((drv, idx) => ({ drv, idx, d: distance(idx, elapsed) }));
  arr.sort((a, b) => b.d - a.d);
  return arr.map((r, pos) => ({ ...r, position: pos + 1 }));
}

function meetings(year: number): Record<string, unknown>[] {
  const base = [
    { name: "Australian Grand Prix", loc: "Melbourne", country: "Australia", cc: "AUS", circuit: "Albert Park", month: 3 },
    { name: "Monaco Grand Prix", loc: "Monte Carlo", country: "Monaco", cc: "MON", circuit: "Monte Carlo", month: 5 },
    { name: "British Grand Prix", loc: "Silverstone", country: "United Kingdom", cc: "GBR", circuit: "Silverstone", month: 7 },
    { name: "Italian Grand Prix", loc: "Monza", country: "Italy", cc: "ITA", circuit: "Monza", month: 9 },
    { name: "São Paulo Grand Prix", loc: "São Paulo", country: "Brazil", cc: "BRA", circuit: "Interlagos", month: 11 },
  ];
  return base.map((m, i) => ({
    meeting_key: year * 100 + i,
    meeting_name: m.name,
    meeting_official_name: `FORMULA 1 ${m.name.toUpperCase()} ${year}`,
    location: m.loc,
    country_name: m.country,
    country_code: m.cc,
    circuit_short_name: m.circuit,
    date_start: `${year}-${String(m.month).padStart(2, "0")}-01T12:00:00Z`,
    year,
  }));
}

function sessions(meetingKey: number): Record<string, unknown>[] {
  // Always anchored to the demo race window so replay math stays consistent.
  const defs = [
    { name: "Practice 1", type: "Practice", off: -3 * 24 * 3600 * 1000, dur: 3600 * 1000 },
    { name: "Qualifying", type: "Qualifying", off: -24 * 3600 * 1000, dur: 3600 * 1000 },
    { name: "Race", type: "Race", off: 0, dur: 2 * 60 * 60 * 1000 },
  ];
  return defs.map((d, i) => ({
    session_key: meetingKey * 10 + i,
    session_name: d.name,
    session_type: d.type,
    meeting_key: meetingKey,
    date_start: isoOf(DEMO_START_MS + d.off),
    date_end: isoOf(DEMO_START_MS + d.off + d.dur),
    location: "Interlagos",
    country_name: "Brazil",
    year: 2024,
  }));
}

function drivers(sessionKey: number, meetingKey: number): Record<string, unknown>[] {
  return DRIVERS.map((d) => ({
    driver_number: d.num,
    first_name: d.first,
    last_name: d.last,
    full_name: `${d.first} ${d.last}`,
    name_acronym: d.acr,
    broadcast_name: `${d.first[0]} ${d.last}`,
    team_name: d.team,
    team_colour: d.colour,
    headshot_url: "",
    country_code: d.cc,
    session_key: sessionKey,
    meeting_key: meetingKey,
  }));
}

function demoData(endpoint: string, params: QueryParams): Record<string, unknown>[] {
  const sessionKey = Number(params.session_key ?? 0);

  switch (endpoint) {
    case "meetings":
      return meetings(Number(params.year ?? new Date().getFullYear()));
    case "sessions":
      return sessions(Number(params.meeting_key ?? 0));
    case "drivers":
      return drivers(sessionKey, Math.floor(sessionKey / 10));
    case "weather":
      return [
        {
          air_temperature: 24.6,
          track_temperature: 41.2,
          humidity: 58,
          pressure: 1011.3,
          rainfall: 0,
          wind_speed: 3.4,
          wind_direction: 210,
          date: isoOf(anchorMs(params)),
        },
      ];
    case "race_control":
      return [
        { date: isoOf(DEMO_START_MS), message: "GREEN LIGHT - PIT EXIT OPEN", category: "Flag", flag: "GREEN" },
        { date: isoOf(DEMO_START_MS + 600000), message: "DRS ENABLED", category: "Other" },
        { date: isoOf(DEMO_START_MS + 1800000), message: "YELLOW IN SECTOR 2", category: "Flag", flag: "YELLOW" },
      ];
    default:
      break;
  }

  const t = anchorMs(params);
  const ranked = ranking(t);

  switch (endpoint) {
    case "position":
      return ranked.map((r) => ({
        driver_number: r.drv.num,
        position: r.position,
        date: isoOf(t),
      }));

    case "intervals": {
      const leaderD = ranked[0].d;
      return ranked.map((r, idx) => {
        const ahead = idx > 0 ? ranked[idx - 1].d : r.d;
        return {
          driver_number: r.drv.num,
          gap_to_leader: idx === 0 ? 0 : (leaderD - r.d) * LAP_SECONDS,
          interval: idx === 0 ? 0 : (ahead - r.d) * LAP_SECONDS,
          date: isoOf(t),
        };
      });
    }

    case "laps":
      return ranked.map((r) => {
        const dur = LAP_SECONDS + Math.sin(r.idx + t / 30000) * 0.8 - r.drv.num * 0.001;
        return {
          driver_number: r.drv.num,
          lap_number: Math.floor(r.d) + 1,
          lap_duration: dur,
          duration_sector_1: dur * 0.31,
          duration_sector_2: dur * 0.4,
          duration_sector_3: dur * 0.29,
          date: isoOf(t),
        };
      });

    case "stints":
      return DRIVERS.map((d, i) => ({
        driver_number: d.num,
        compound: COMPOUNDS[i % COMPOUNDS.length],
        tyre_age_at_start: 2 + (i % 4),
        stint_number: 1,
        date: isoOf(DEMO_START_MS),
      }));

    case "pit": {
      const rows: Record<string, unknown>[] = [];
      ranked.forEach((r) => {
        if (r.drv.num % 3 === 0 && r.d > 1) {
          rows.push({ driver_number: r.drv.num, date: isoOf(DEMO_START_MS + 900000) });
        }
      });
      return rows;
    }

    case "car_data": {
      const leaderD = ranked[0].d;
      return ranked.map((r, idx) => {
        const ahead = idx > 0 ? ranked[idx - 1].d : r.d;
        const intervalSec = idx === 0 ? 99 : (ahead - r.d) * LAP_SECONDS;
        const u = ((r.d % 1) + 1) % 1;
        return {
          driver_number: r.drv.num,
          drs: intervalSec < 1 ? 12 : 0,
          speed: Math.round(250 + 70 * Math.abs(Math.sin(u * 2 * Math.PI))),
          date: isoOf(t),
        };
      });
    }

    case "location": {
      const driverNum = Number(params.driver_number ?? 0);
      if (driverNum > 0) {
        // Outline trace: one driver sampled around a full lap.
        const rows: Record<string, unknown>[] = [];
        const samples = 200;
        for (let k = 0; k < samples; k++) {
          const { x, y } = circuitXY(k / samples);
          rows.push({ driver_number: driverNum, x, y, date: isoOf(DEMO_START_MS + k * 100) });
        }
        return rows;
      }
      // Live/replay car positions at the anchor.
      return ranked.map((r) => {
        const u = ((r.d % 1) + 1) % 1;
        const { x, y } = circuitXY(u);
        return { driver_number: r.drv.num, x, y, date: isoOf(t) };
      });
    }

    case "session_result": {
      const finalRank = ranking(SESSION_END_MS);
      const pts = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
      return finalRank.map((r) => ({
        position: r.position,
        driver_number: r.drv.num,
        points: pts[r.position - 1] ?? 0,
        number_of_laps: Math.floor(r.d),
        dnf: false,
        dns: false,
        dsq: false,
      }));
    }

    default:
      return [];
  }
}

export function isDemoMode(): boolean {
  return process.env.DEMO_DATA === "1";
}

export function demoFetch<T>(endpoint: string, params: QueryParams): T[] {
  return demoData(endpoint, params) as T[];
}
