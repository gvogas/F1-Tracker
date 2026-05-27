"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ClockMode = "live" | "replay";

export interface ReplayClock {
  clockMs: number;
  iso: string | null;
  mode: ClockMode;
  speed: number;
  playing: boolean;
  startMs: number;
  endMs: number;
  progress: number; // 0..1 across [startMs, endMs]
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (n: number) => void;
  scrub: (ms: number) => void;
  scrubFraction: (f: number) => void;
  setMode: (m: ClockMode) => void;
  reset: (
    startMs: number,
    endMs: number,
    mode: ClockMode,
    startPlaying: boolean,
    initialMs?: number,
  ) => void;
}

export const SPEEDS = [1, 2, 5, 10, 30];
const TICK_MS = 1000;

export function useReplayClock(defaultSpeed = 5): ReplayClock {
  const [clockMs, setClockMs] = useState(0);
  const [mode, setModeState] = useState<ClockMode>("replay");
  const [speed, setSpeedState] = useState(defaultSpeed);
  const [playing, setPlaying] = useState(false);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const endRef = useRef(endMs);
  endRef.current = endMs;

  useEffect(() => {
    if (!playing || mode !== "replay") return;
    const id = setInterval(() => {
      setClockMs((prev) => {
        const next = prev + speedRef.current * TICK_MS;
        const cap = endRef.current;
        if (cap > 0 && next >= cap) {
          setPlaying(false);
          return cap;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, mode]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const setSpeed = useCallback((n: number) => setSpeedState(n), []);
  const scrub = useCallback((ms: number) => setClockMs(ms), []);
  const scrubFraction = useCallback(
    (f: number) => setClockMs(startMs + (endMs - startMs) * Math.min(1, Math.max(0, f))),
    [startMs, endMs],
  );
  const setMode = useCallback((m: ClockMode) => setModeState(m), []);

  const reset = useCallback(
    (s: number, e: number, m: ClockMode, startPlaying: boolean, initialMs?: number) => {
      setStartMs(s);
      setEndMs(e);
      setClockMs(initialMs ?? s);
      setModeState(m);
      setPlaying(m === "replay" ? startPlaying : false);
    },
    [],
  );

  const iso = mode === "replay" ? new Date(clockMs).toISOString() : null;
  const span = endMs - startMs;
  const progress = span > 0 ? Math.min(1, Math.max(0, (clockMs - startMs) / span)) : 0;

  return {
    clockMs,
    iso,
    mode,
    speed,
    playing,
    startMs,
    endMs,
    progress,
    play,
    pause,
    toggle,
    setSpeed,
    scrub,
    scrubFraction,
    setMode,
    reset,
  };
}
