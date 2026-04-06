"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readRecentBoards } from "../lib/boardHistory";
import { RecentBoardEntry, formatPlannerLocationLabel } from "../lib/transportApi";

export default function RecentBoardStrip() {
  const [entries, setEntries] = useState<RecentBoardEntry[]>([]);

  useEffect(() => {
    setEntries(readRecentBoards());
  }, []);

  if (entries.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[var(--foreground)]">Recent boards</h2>
        <Link href="/boards" className="text-sm font-semibold text-[var(--brand)]">See all</Link>
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.slice(0, 6).map((entry) => (
          <Link
            key={`${entry.mode}:${entry.location.type}:${entry.location.id}`}
            href={entry.href}
            className="group flex min-w-[180px] shrink-0 items-center gap-2.5 rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 transition hover:border-[var(--brand)] hover:shadow-[var(--shadow-soft)]"
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${entry.mode === "rail" ? "bg-[var(--brand)]" : "bg-amber-500"}`}>
              {entry.mode === "rail" ? "R" : "B"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                {formatPlannerLocationLabel(entry.location)}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {entry.mode === "rail" ? "Rail board" : "Bus board"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
