import type {
  DriverModel,
  MeetingModel,
  SessionModel,
  WeatherModel,
} from "@/types/f1";
import { windCompass } from "./format";

type Raw = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function toDriver(d: Raw): DriverModel {
  const first = str(d.first_name);
  const last = str(d.last_name);
  const full = str(d.full_name) || `${first} ${last}`.trim();
  return {
    number: num(d.driver_number),
    fullName: full,
    firstName: first,
    lastName: last,
    acronym: str(d.name_acronym).toUpperCase(),
    broadcastName: str(d.broadcast_name),
    teamName: str(d.team_name),
    teamColour: str(d.team_colour).replace(/^#/, ""),
    headshotUrl: str(d.headshot_url),
    countryCode: str(d.country_code),
    sessionKey: num(d.session_key),
    meetingKey: num(d.meeting_key),
  };
}

/** Dedupe drivers by number (keep latest seen), sorted by number ascending. */
export function normalizeDrivers(raw: Raw[]): DriverModel[] {
  const byNumber = new Map<number, DriverModel>();
  for (const d of raw) {
    const n = num(d.driver_number);
    if (n > 0) byNumber.set(n, toDriver(d));
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export function toMeeting(m: Raw): MeetingModel {
  return {
    key: num(m.meeting_key),
    name: str(m.meeting_name),
    officialName: str(m.meeting_official_name),
    location: str(m.location),
    countryName: str(m.country_name),
    countryCode: str(m.country_code),
    circuitName: str(m.circuit_short_name),
    dateStart: str(m.date_start),
    year: num(m.year),
  };
}

export function normalizeMeetings(raw: Raw[]): MeetingModel[] {
  return raw.map(toMeeting).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
}

export function toSession(s: Raw): SessionModel {
  return {
    key: num(s.session_key),
    name: str(s.session_name),
    type: str(s.session_type),
    meetingKey: num(s.meeting_key),
    dateStart: str(s.date_start),
    dateEnd: str(s.date_end),
    location: str(s.location),
    countryName: str(s.country_name),
    year: num(s.year),
  };
}

export function normalizeSessions(raw: Raw[]): SessionModel[] {
  return raw.map(toSession).sort((a, b) => a.dateStart.localeCompare(b.dateStart));
}

export function toWeather(w: Raw): WeatherModel {
  const dir = num(w.wind_direction);
  return {
    airTemp: num(w.air_temperature),
    trackTemp: num(w.track_temperature),
    humidity: num(w.humidity),
    pressure: num(w.pressure),
    rainfall: num(w.rainfall),
    windSpeed: num(w.wind_speed),
    windDirection: dir,
    windCompass: windCompass(dir),
    date: str(w.date),
  };
}

/** Latest weather entry by date, or null. */
export function latestWeather(raw: Raw[]): WeatherModel | null {
  if (!raw.length) return null;
  const sorted = [...raw].sort((a, b) => str(a.date).localeCompare(str(b.date)));
  return toWeather(sorted[sorted.length - 1]);
}
