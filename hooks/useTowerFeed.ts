"use client";

import { useEffect, useRef, useState } from "react";
import { f1api } from "@/lib/api";
import type { ClockMode } from "./useReplayClock";
import type { TowerRow } from "@/types/f1";

const LIVE_POLL_MS = 5000;

export function useTowerFeed(sessionKey: number | null, iso: string | null, mode: ClockMode) {
  const [rows, setRows] = useState<TowerRow[]>([]);
  const inFlight = useRef(false);
  const sessionRef = useRef<number | null>(sessionKey);
  sessionRef.current = sessionKey;

  useEffect(() => {
    if (!sessionKey) {
      setRows([]);
      return;
    }

    const fetchOnce = async (date: string | null) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const sk = sessionKey;
      try {
        const data = await f1api.tower(sk, date);
        if (sessionRef.current === sk) setRows(data);
      } catch {
        /* keep last rows; backoff handled in apiFetch */
      } finally {
        inFlight.current = false;
      }
    };

    if (mode === "replay") {
      if (iso) void fetchOnce(iso);
      return;
    }

    void fetchOnce(null);
    const id = setInterval(() => void fetchOnce(null), LIVE_POLL_MS);
    return () => clearInterval(id);
  }, [sessionKey, iso, mode]);

  return rows;
}
