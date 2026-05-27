"use client";

import { motion } from "framer-motion";
import type { TowerRow as Row } from "@/types/f1";
import { drsState, sectorPercents, TYRE_COLOR, teamHex } from "@/lib/f1/display";

interface Props {
  row: Row;
  isFavorite: boolean;
  onToggleFavorite: (driverNumber: number) => void;
}

export function TowerRow({ row, isFavorite, onToggleFavorite }: Props) {
  const drs = drsState(row.drs);
  const { s1p, s2p, s3p } = sectorPercents(row.sector1, row.sector2, row.sector3);
  const tyre = TYRE_COLOR[row.compound];
  const team = teamHex(row.driver.teamColour);

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
      onClick={() => onToggleFavorite(row.driverNumber)}
      className={[
        "grid cursor-pointer select-none items-center gap-2 rounded-lg border px-2 py-1.5 text-sm",
        "grid-cols-[28px_64px_70px_minmax(70px,1fr)_minmax(64px,1fr)_minmax(70px,1fr)_90px]",
        isFavorite
          ? "border-f1red bg-f1red/10 shadow-[0_0_18px_rgba(225,6,0,0.25)]"
          : "border-white/5 bg-white/[0.02] hover:border-white/15",
      ].join(" ")}
    >
      {/* position */}
      <div className="text-center font-bold tabular-nums">{row.position || "—"}</div>

      {/* driver code with team-colour underline */}
      <div className="font-mono font-bold">
        <span
          className="inline-block border-b-2 pb-0.5"
          style={{ borderColor: team }}
          title={row.driver.fullName}
        >
          {row.driver.acronym || `#${row.driverNumber}`}
        </span>
      </div>

      {/* tyre */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-black"
          style={{ background: tyre }}
        >
          {row.compound === "?" ? "" : row.compound}
        </span>
        {row.tyreAge > 0 && <span className="text-xs text-zinc-500">{row.tyreAge}L</span>}
      </div>

      {/* gap to leader */}
      <div className="tabular-nums text-zinc-200">{row.gap}</div>

      {/* interval */}
      <div className="tabular-nums text-zinc-400">{row.interval}</div>

      {/* last lap */}
      <div className="font-mono tabular-nums text-zinc-300">{row.lastLap}</div>

      {/* DRS + sectors */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className={[
              "rounded px-1 text-[10px] font-bold",
              drs === "on"
                ? "bg-green-500 text-black"
                : drs === "eligible"
                  ? "bg-green-500/25 text-green-300"
                  : "bg-white/5 text-zinc-600",
            ].join(" ")}
          >
            DRS
          </span>
          {row.pitCount > 0 && (
            <span className="text-[10px] text-zinc-500">{row.pitCount} stop</span>
          )}
        </div>
        <div className="flex gap-0.5">
          {[s1p, s2p, s3p].map((p, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                style={{ width: `${p}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
