"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { f1api } from "@/lib/api";

const REFRESH_MS = 30000;

export function useAiCommentary(sessionKey: number | null, iso: string | null) {
  const [text, setText] = useState("");
  const [ai, setAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const isoRef = useRef(iso);
  isoRef.current = iso;
  const inFlight = useRef(false);
  const sessionRef = useRef<number | null>(sessionKey);
  sessionRef.current = sessionKey;

  const fetchNow = useCallback(async () => {
    if (!sessionKey || inFlight.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    inFlight.current = true;
    setLoading(true);
    setError(false);
    const sk = sessionKey;
    try {
      const res = await f1api.commentary(sk, isoRef.current);
      if (sessionRef.current !== sk) return;
      setText(res.commentary);
      setAi(res.ai);
    } catch {
      if (sessionRef.current === sk) setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) {
      setText("");
      return;
    }
    void fetchNow();
    const id = setInterval(() => void fetchNow(), REFRESH_MS);
    return () => clearInterval(id);
  }, [sessionKey, fetchNow]);

  return { text, ai, loading, error, retry: fetchNow };
}
