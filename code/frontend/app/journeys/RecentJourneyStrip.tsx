"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type RecentJourney = {
  originName: string;
  originLocalityName: string | null;
  destinationName: string;
  destinationLocalityName: string | null;
  href: string;
  timestamp: number;
};

const STORAGE_KEY = "recentJourneys";
const MAX_RECENT = 10;

export function saveRecentJourney(journey: Omit<RecentJourney, "timestamp">) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: RecentJourney[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(
      (j) => j.originName !== journey.originName || j.destinationName !== journey.destinationName
    );
    filtered.unshift({ ...journey, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

function formatLabel(name: string, locality: string | null): string {
  if (locality) return `${name}, ${locality}`;
  return name;
}

export default function RecentJourneyStrip() {
  const [journeys, setJourneys] = useState<RecentJourney[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setJourneys(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  if (journeys.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-6 text-center">
        <div className="text-sm font-semibold text-[var(--foreground)]">No recent journeys</div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Use the planner below to search for a route. Your recent searches will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {journeys.map((journey, index) => (
        <Link
          key={`${journey.originName}-${journey.destinationName}-${index}`}
          href={journey.href}
          className="group flex w-[200px] shrink-0 flex-col justify-between rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)]/40 hover:shadow-[var(--shadow-soft)]"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15 text-[0.55rem] font-bold text-[var(--brand)]">
                {index + 1}
              </span>
              <span className="truncate text-xs font-semibold text-[var(--foreground)]">
                {formatLabel(journey.originName, journey.originLocalityName)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 pl-[26px]">
              <svg className="h-3 w-3 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="truncate text-xs text-[var(--muted)]">
                {formatLabel(journey.destinationName, journey.destinationLocalityName)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
