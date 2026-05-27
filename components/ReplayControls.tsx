"use client";

import { SPEEDS, type ReplayClock } from "@/hooks/useReplayClock";

interface Props {
  clock: ReplayClock;
  liveAvailable: boolean;
}

function fmtClock(ms: number, startMs: number): string {
  const elapsed = Math.max(0, Math.floor((ms - startMs) / 1000));
  const hh = Math.floor(elapsed / 3600);
  const mm = Math.floor((elapsed % 3600) / 60);
  const ss = elapsed % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}`;
}

export function ReplayControls({ clock, liveAvailable }: Props) {
  const isLive = clock.mode === "live";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-panel px-3 py-2">
      {/* mode toggle */}
      <div className="flex overflow-hidden rounded-lg border border-white/10">
        <button
          onClick={() => clock.setMode("replay")}
          className={`px-3 py-1.5 text-xs font-semibold ${
            !isLive ? "bg-white/10 text-white" : "text-zinc-400"
          }`}
        >
          Replay
        </button>
        <button
          onClick={() => liveAvailable && clock.setMode("live")}
          disabled={!liveAvailable}
          title={liveAvailable ? "" : "No session is live right now"}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
            isLive
              ? "bg-f1red text-white"
              : liveAvailable
                ? "text-zinc-300"
                : "cursor-not-allowed text-zinc-600"
          }`}
        >
          {liveAvailable && <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />}
          Live
        </button>
      </div>

      {!isLive && (
        <>
          <button
            onClick={clock.toggle}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold transition hover:bg-white/20"
          >
            {clock.playing ? "❚❚ Pause" : "▶ Play"}
          </button>

          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => clock.setSpeed(s)}
                className={`rounded px-2 py-1 text-xs font-semibold tabular-nums ${
                  clock.speed === s ? "bg-f1red text-white" : "bg-white/5 text-zinc-400"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <span className="font-mono text-sm tabular-nums text-zinc-300">
            {fmtClock(clock.clockMs, clock.startMs)}
          </span>

          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(clock.progress * 1000)}
            onChange={(e) => clock.scrubFraction(Number(e.target.value) / 1000)}
            className="h-1.5 min-w-[140px] flex-1 cursor-pointer accent-f1red"
          />
        </>
      )}

      {isLive && (
        <span className="text-sm text-zinc-400">Streaming live timing — updates every few seconds.</span>
      )}
    </div>
  );
}
