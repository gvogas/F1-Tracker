"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "f1_prefs";

export interface Preferences {
  favoriteDriver: number | null;
  defaultSpeed: number;
}

const DEFAULTS: Preferences = { favoriteDriver: null, defaultSpeed: 5 };

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (driverNumber: number) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          favoriteDriver: prev.favoriteDriver === driverNumber ? null : driverNumber,
        };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  return { prefs, loaded, update, toggleFavorite };
}
