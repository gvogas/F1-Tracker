"use client";

import { useEffect, useRef, useState } from "react";
import { f1api } from "@/lib/api";
import type { ClockMode } from "./useReplayClock";
import type { LocationPoint, TrackPoint } from "@/types/f1";

const LIVE_POLL_MS = 3000;

export function useTrackData(
  sessionKey: number | null,
  iso: string | null,
  mode: ClockMode,
  visible: boolean,
) {
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [locations, setLocations] = useState<LocationPoint[]>([]);

  const sessionRef = useRef<number | null>(sessionKey);
  sessionRef.current = sessionKey;
  const outlineLoadedFor = useRef<number | null>(null);
  const locInFlight = useRef(false);

  // Track outline — load once per session (retry across ticks until points arrive).
  useEffect(() => {
    if (!sessionKey) {
      setTrackPoints([]);
      outlineLoadedFor.current = null;
      return;
    }
    if (outlineLoadedFor.current === sessionKey) return;
    const sk = sessionKey;
    f1api
      .trackOutline(sk, iso)
      .then((pts) => {
        if (sessionRef.current !== sk) return;
        if (pts.length) {
          setTrackPoints(pts);
          outlineLoadedFor.current = sk;
        }
      })
      .catch(() => {});
  }, [sessionKey, iso]);

  // Car positions.
  useEffect(() => {
    if (!sessionKey || !visible) return;

    const fetchLoc = async (date: string | null) => {
      if (locInFlight.current) return;
      locInFlight.current = true;
      const sk = sessionKey;
      try {
        const data = await f1api.location(sk, date);
        if (sessionRef.current === sk) setLocations(data);
      } catch {
        /* keep last */
      } finally {
        locInFlight.current = false;
      }
    };

    if (mode === "replay") {
      if (iso) void fetchLoc(iso);
      return;
    }

    void fetchLoc(null);
    const id = setInterval(() => void fetchLoc(null), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [sessionKey, iso, mode, visible]);

  return { trackPoints, locations };
}
