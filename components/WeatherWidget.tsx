"use client";

import { useEffect, useState } from "react";
import { f1api } from "@/lib/api";
import type { WeatherModel } from "@/types/f1";

const POLL_MS = 60000;

export function WeatherWidget({ sessionKey }: { sessionKey: number | null }) {
  const [w, setW] = useState<WeatherModel | null>(null);

  useEffect(() => {
    if (!sessionKey) return;
    let active = true;
    const load = () =>
      f1api
        .weather(sessionKey)
        .then((data) => active && setW(data))
        .catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [sessionKey]);

  if (!w) return null;

  const items: [string, string][] = [
    ["Air", `${w.airTemp.toFixed(1)}°C`],
    ["Track", `${w.trackTemp.toFixed(1)}°C`],
    ["Humidity", `${Math.round(w.humidity)}%`],
    ["Wind", `${w.windSpeed.toFixed(1)} ${w.windCompass}`],
    ["Rain", w.rainfall > 0 ? "Yes" : "Dry"],
  ];

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl border border-white/10 bg-panel px-3 py-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
          <span className="font-semibold tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}
