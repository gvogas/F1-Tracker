"use client";

import { apiFetch, qs } from "@/lib/http/clientFetch";
import type {
  DriverModel,
  LocationPoint,
  MeetingModel,
  SessionModel,
  TowerRow,
  TrackPoint,
  WeatherModel,
} from "@/types/f1";

export const f1api = {
  meetings: (year: number) => apiFetch<MeetingModel[]>(`/api/meetings${qs({ year })}`),
  sessions: (meetingKey: number) =>
    apiFetch<SessionModel[]>(`/api/sessions${qs({ meeting_key: meetingKey })}`),
  drivers: (sessionKey: number) =>
    apiFetch<DriverModel[]>(`/api/drivers${qs({ session_key: sessionKey })}`),
  weather: (sessionKey: number) =>
    apiFetch<WeatherModel | null>(`/api/weather${qs({ session_key: sessionKey })}`),
  tower: (sessionKey: number, date?: string | null) =>
    apiFetch<TowerRow[]>(`/api/tower${qs({ session_key: sessionKey, date })}`),
  location: (sessionKey: number, date?: string | null) =>
    apiFetch<LocationPoint[]>(`/api/location${qs({ session_key: sessionKey, date })}`),
  trackOutline: (sessionKey: number, date?: string | null) =>
    apiFetch<TrackPoint[]>(`/api/track-outline${qs({ session_key: sessionKey, date })}`),
  commentary: (sessionKey: number, date?: string | null) =>
    apiFetch<{ commentary: string; ai: boolean }>(`/api/ai/commentator`, {
      method: "POST",
      body: { session_key: sessionKey, date },
    }),
};
