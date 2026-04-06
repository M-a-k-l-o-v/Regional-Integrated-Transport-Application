"use client";

import { useCallback, useEffect, useState } from "react";

type ThemePref = "auto" | "light" | "dark";

const CYCLE: ThemePref[] = ["auto", "light", "dark"];

function getStoredPref(): ThemePref {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem("theme-preference");
  if (stored === "light" || stored === "dark") return stored;
  return "auto";
}

function applyTheme(pref: ThemePref) {
  if (pref === "auto") {
    localStorage.removeItem("theme-preference");
  } else {
    localStorage.setItem("theme-preference", pref);
  }
  // Trigger the inline script's listener
  const theme =
    pref === "light"
      ? "day"
      : pref === "dark"
      ? "night"
      : new Date().getHours() >= 18 || new Date().getHours() < 6
      ? "night"
      : "day";
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("auto");

  useEffect(() => {
    setPref(getStoredPref());
  }, []);

  const cycle = useCallback(() => {
    const nextIndex = (CYCLE.indexOf(pref) + 1) % CYCLE.length;
    const next = CYCLE[nextIndex];
    setPref(next);
    applyTheme(next);
  }, [pref]);

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex items-center gap-1.5 rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--foreground)]"
      title={`Theme: ${pref}`}
    >
      {pref === "light" ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : pref === "dark" ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
      <span className="hidden sm:inline">
        {pref === "auto" ? "Auto" : pref === "light" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
