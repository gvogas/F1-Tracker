"use client";

import { TowerRow } from "./TowerRow";
import type { TowerRow as Row } from "@/types/f1";

interface Props {
  rows: Row[];
  favoriteDriver: number | null;
  onToggleFavorite: (driverNumber: number) => void;
}

export function TimingTower({ rows, favoriteDriver, onToggleFavorite }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-panel">
      <div className="grid grid-cols-[28px_64px_70px_minmax(70px,1fr)_minmax(64px,1fr)_minmax(70px,1fr)_90px] gap-2 border-b border-white/10 px-2 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
        <div className="text-center">P</div>
        <div>Driver</div>
        <div>Tyre</div>
        <div>Gap</div>
        <div>Int</div>
        <div>Last</div>
        <div>DRS / Sectors</div>
      </div>
      <div className="f1-scroll flex max-h-[70vh] flex-col gap-1 overflow-y-auto p-2">
        {rows.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-zinc-500">
            Waiting for timing data…
          </div>
        ) : (
          rows.map((row) => (
            <TowerRow
              key={row.driverNumber}
              row={row}
              isFavorite={favoriteDriver === row.driverNumber}
              onToggleFavorite={onToggleFavorite}
            />
          ))
        )}
      </div>
    </div>
  );
}
