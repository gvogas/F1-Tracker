import type { TowerRow } from "@/types/f1";
import { fmtGap, fmtLapTime, latestByDriver, normalizeCompound } from "./format";
import { normalizeDrivers } from "./normalize";

type Raw = Record<string, unknown>;

export interface TowerStreams {
  positions: Raw[];
  intervals: Raw[];
  laps: Raw[];
  stints: Raw[];
  pits: Raw[];
  drivers: Raw[];
  carData: Raw[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Merge the raw OpenF1 streams into one row per driver, sorted by position.
 * Pure function — no I/O — so it is trivially testable and reusable.
 */
export function assembleTower(s: TowerStreams): TowerRow[] {
  const drivers = normalizeDrivers(s.drivers);
  const drvMap = new Map(drivers.map((d) => [d.number, d]));

  const latestPos = latestByDriver(s.positions);
  const latestInt = latestByDriver(s.intervals);
  const latestLap = latestByDriver(s.laps);
  const latestCar = latestByDriver(s.carData);

  const stintsByDriver = new Map<number, Raw[]>();
  for (const st of s.stints) {
    const n = num(st.driver_number);
    if (n <= 0) continue;
    (stintsByDriver.get(n) ?? stintsByDriver.set(n, []).get(n)!).push(st);
  }

  const pitsByDriver = new Map<number, Raw[]>();
  for (const p of s.pits) {
    const n = num(p.driver_number);
    if (n <= 0) continue;
    (pitsByDriver.get(n) ?? pitsByDriver.set(n, []).get(n)!).push(p);
  }

  const rows: TowerRow[] = [];
  for (const [n, pos] of latestPos) {
    const driver =
      drvMap.get(n) ??
      ({
        number: n,
        fullName: `#${n}`,
        firstName: "",
        lastName: "",
        acronym: `#${n}`,
        broadcastName: "",
        teamName: "",
        teamColour: "",
        headshotUrl: "",
        countryCode: "",
        sessionKey: 0,
        meetingKey: 0,
      } satisfies TowerRow["driver"]);

    const intData = latestInt.get(n) ?? {};
    const lapData = latestLap.get(n) ?? {};
    const carData = latestCar.get(n) ?? {};
    const drvStints = stintsByDriver.get(n) ?? [];
    const drvPits = pitsByDriver.get(n) ?? [];
    const latestStint = drvStints[drvStints.length - 1] ?? {};

    rows.push({
      driverNumber: n,
      position: num(pos.position),
      driver,
      gap: fmtGap(intData.gap_to_leader ?? null),
      interval: fmtGap(intData.interval ?? null),
      lapNumber: num(lapData.lap_number),
      lastLap: fmtLapTime(lapData.lap_duration),
      sector1: num(lapData.duration_sector_1),
      sector2: num(lapData.duration_sector_2),
      sector3: num(lapData.duration_sector_3),
      compound: normalizeCompound(latestStint.compound),
      tyreAge: num(latestStint.tyre_age_at_start),
      pitCount: drvPits.length,
      drs: num(carData.drs),
      speed: num(carData.speed),
    });
  }

  rows.sort((a, b) => a.position - b.position);
  return rows;
}
