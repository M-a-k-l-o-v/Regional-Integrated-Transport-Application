"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** How many seconds between automatic refreshes. Defaults to 90. */
  intervalSeconds?: number;
};

export default function BoardAutoRefresh({ intervalSeconds = 90 }: Props) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(intervalSeconds);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setCountdown(intervalSeconds);
    // Clear the spinner after a short delay
    setTimeout(() => setRefreshing(false), 1200);
  }, [router, intervalSeconds]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refresh();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [refresh, intervalSeconds]);

  // Refresh when the tab regains focus
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <span
          className={`h-2 w-2 rounded-full ${refreshing ? "animate-pulse bg-[var(--brand)]" : "bg-[var(--brand)]"} opacity-70`}
        />
        <span>{refreshing ? "Refreshing board…" : `Auto-refresh in ${countdown}s`}</span>
      </div>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="rounded-full bg-[var(--surface-accent)] px-3 py-1 text-xs font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-accent-strong)] disabled:opacity-50"
      >
        Refresh now
      </button>
    </div>
  );
}
