"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { f1api } from "@/lib/api";
import { pickBestSession } from "@/lib/f1/sessions";
import { teamHex } from "@/lib/f1/display";
import { useReplayClock } from "@/hooks/useReplayClock";
import { useTowerFeed } from "@/hooks/useTowerFeed";
import { useTrackData } from "@/hooks/useTrackData";
import { useAiCommentary } from "@/hooks/useAiCommentary";
import { usePreferences } from "@/hooks/usePreferences";
import { SessionPicker } from "./SessionPicker";
import { TimingTower } from "./TimingTower";
import { TrackMap, type DriverMeta } from "./TrackMap";
import { ReplayControls } from "./ReplayControls";
import { WeatherWidget } from "./WeatherWidget";
import { AICommentaryPanel } from "./AICommentaryPanel";
import type { SessionModel } from "@/types/f1";

const CURRENT_YEAR = new Date().getFullYear();
const REPLAY_START_OFFSET_MS = 150_000; // start ~2.5 min after green
const DEFAULT_SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

function isSessionLive(s: SessionModel): boolean {
  const st = Date.parse(s.dateStart);
  const en = Date.parse(s.dateEnd);
  const now = Date.now();
  return Number.isFinite(st) && Number.isFinite(en) && now >= st && now <= en;
}

export function Dashboard() {
  const { prefs, toggleFavorite } = usePreferences();
  const clock = useReplayClock(prefs.defaultSpeed);
  const [selected, setSelected] = useState<SessionModel | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);
  const bootstrapped = useRef(false);

  const applySession = useCallback(
    (session: SessionModel) => {
      setSelected(session);
      const startMs = Date.parse(session.dateStart);
      const endRaw = Date.parse(session.dateEnd);
      const start = Number.isFinite(startMs) ? startMs : Date.now();
      const end = Number.isFinite(endRaw) ? endRaw : start + DEFAULT_SESSION_DURATION_MS;
      const live = isSessionLive(session);
      setLiveAvailable(live);
      if (live) {
        clock.reset(start, end, "live", false);
      } else {
        const initial = Math.min(start + REPLAY_START_OFFSET_MS, end);
        clock.reset(start, end, "replay", true, initial);
      }
    },
    [clock],
  );

  // Demo bootstrap: prefer a live session, else replay a recent completed race.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;

    (async () => {
      // 1. Live session in the current season's latest event?
      try {
        const meetings = await f1api.meetings(CURRENT_YEAR);
        if (meetings.length) {
          const latest = meetings[meetings.length - 1];
          const sessions = await f1api.sessions(latest.key);
          const live = sessions.find(isSessionLive);
          if (live && !cancelled) {
            applySession(live);
            return;
          }
        }
      } catch {
        /* fall through to replay */
      }

      // 2. Default replay — 2024 Brazilian GP race (fallback: last race of 2024).
      try {
        const meetings = await f1api.meetings(2024);
        if (!meetings.length || cancelled) return;
        const brazil = meetings.find((m) =>
          /bra[sz]il|sao paulo|são paulo|interlagos/i.test(
            `${m.name} ${m.location} ${m.countryName} ${m.circuitName}`,
          ),
        );
        const meeting = brazil ?? meetings[meetings.length - 1];
        const sessions = await f1api.sessions(meeting.key);
        const race = pickBestSession(sessions);
        if (race && !cancelled) applySession(race);
      } catch {
        /* nothing to show; picker still works */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const sessionKey = selected?.key ?? null;
  const rows = useTowerFeed(sessionKey, clock.iso, clock.mode);
  const { trackPoints, locations } = useTrackData(sessionKey, clock.iso, clock.mode, mapVisible);
  const commentary = useAiCommentary(sessionKey, clock.iso);

  const driverMeta = useMemo<Record<number, DriverMeta>>(() => {
    const meta: Record<number, DriverMeta> = {};
    for (const r of rows) {
      meta[r.driverNumber] = {
        color: teamHex(r.driver.teamColour),
        acronym: r.driver.acronym || `#${r.driverNumber}`,
        position: r.position,
      };
    }
    return meta;
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {selected ? `${selected.location || ""} — ${selected.name}` : "Live Dashboard"}
          </h1>
          <p className="text-xs text-zinc-500">
            {selected?.countryName} {selected?.year ? `· ${selected.year}` : ""}
          </p>
        </div>
        <SessionPicker selected={selected} onChange={applySession} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ReplayControls clock={clock} liveAvailable={liveAvailable} />
        <WeatherWidget sessionKey={sessionKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <TimingTower
          rows={rows}
          favoriteDriver={prefs.favoriteDriver}
          onToggleFavorite={toggleFavorite}
        />
        <div className="flex flex-col gap-4">
          <TrackMap
            trackPoints={trackPoints}
            locations={locations}
            driverMeta={driverMeta}
            onVisibleChange={setMapVisible}
          />
          <AICommentaryPanel
            text={commentary.text}
            ai={commentary.ai}
            loading={commentary.loading}
            error={commentary.error}
            onRetry={commentary.retry}
          />
        </div>
      </div>
    </div>
  );
}
