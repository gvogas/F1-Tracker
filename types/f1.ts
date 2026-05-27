export interface MeetingModel {
  key: number;
  name: string;
  officialName: string;
  location: string;
  countryName: string;
  countryCode: string;
  circuitName: string;
  dateStart: string;
  year: number;
}

export interface SessionModel {
  key: number;
  name: string;
  type: string;
  meetingKey: number;
  dateStart: string;
  dateEnd: string;
  location: string;
  countryName: string;
  year: number;
}

export interface DriverModel {
  number: number;
  fullName: string;
  firstName: string;
  lastName: string;
  acronym: string;
  broadcastName: string;
  teamName: string;
  /** hex without leading '#' */
  teamColour: string;
  headshotUrl: string;
  countryCode: string;
  sessionKey: number;
  meetingKey: number;
}

export interface WeatherModel {
  airTemp: number;
  trackTemp: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  windSpeed: number;
  windDirection: number;
  windCompass: string;
  date: string;
}

export type Compound = "S" | "M" | "H" | "I" | "W" | "?";

export interface TowerRow {
  driverNumber: number;
  position: number;
  driver: DriverModel;
  gap: string;
  interval: string;
  lapNumber: number;
  lastLap: string;
  sector1: number;
  sector2: number;
  sector3: number;
  compound: Compound;
  tyreAge: number;
  pitCount: number;
  drs: number;
  speed: number;
}

export interface LocationPoint {
  driverNumber: number;
  x: number;
  y: number;
  date: string;
}

export interface TrackPoint {
  x: number;
  y: number;
}

export interface ResultRow {
  position: number;
  driver: DriverModel;
  points: number;
  laps: number;
  status: string;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}
