"use client";

import { useEffect, useRef, useState } from "react";
import { f1api } from "@/lib/api";
import { pickBestSession } from "@/lib/f1/sessions";
import type { MeetingModel, SessionModel } from "@/types/f1";

interface Props {
  selected: SessionModel | null;
  onChange: (session: SessionModel) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2022 }, (_, i) => CURRENT_YEAR - i);

const selectClass =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-white/30";

export function SessionPicker({ selected, onChange }: Props) {
  const [year, setYear] = useState(selected?.year || CURRENT_YEAR);
  const [meetings, setMeetings] = useState<MeetingModel[]>([]);
  const [meetingKey, setMeetingKey] = useState<number>(selected?.meetingKey ?? 0);
  const [sessions, setSessions] = useState<SessionModel[]>([]);
  const selectedKeyRef = useRef<number | null>(selected?.key ?? null);
  selectedKeyRef.current = selected?.key ?? null;

  // Sync dropdowns to an externally-set selection (e.g. demo bootstrap).
  useEffect(() => {
    if (!selected) return;
    setYear((y) => (selected.year && selected.year !== y ? selected.year : y));
    setMeetingKey((mk) => (selected.meetingKey !== mk ? selected.meetingKey : mk));
  }, [selected]);

  useEffect(() => {
    let active = true;
    f1api
      .meetings(year)
      .then((m) => active && setMeetings(m))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [year]);

  useEffect(() => {
    if (!meetingKey) {
      setSessions([]);
      return;
    }
    let active = true;
    f1api
      .sessions(meetingKey)
      .then((s) => active && setSessions(s))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [meetingKey]);

  // When sessions load for a meeting and none match the current selection, auto-pick the headline session.
  useEffect(() => {
    if (!sessions.length) return;
    if (sessions.some((s) => s.key === selectedKeyRef.current)) return;
    const best = pickBestSession(sessions);
    if (best) onChange(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className={selectClass}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <select
        value={meetingKey || ""}
        onChange={(e) => setMeetingKey(Number(e.target.value))}
        className={`${selectClass} max-w-[220px]`}
      >
        <option value="" disabled>
          Select a Grand Prix…
        </option>
        {meetings.map((m) => (
          <option key={m.key} value={m.key}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        value={selected?.key ?? ""}
        onChange={(e) => {
          const s = sessions.find((x) => x.key === Number(e.target.value));
          if (s) onChange(s);
        }}
        className={selectClass}
        disabled={!sessions.length}
      >
        <option value="" disabled>
          Session…
        </option>
        {sessions.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
