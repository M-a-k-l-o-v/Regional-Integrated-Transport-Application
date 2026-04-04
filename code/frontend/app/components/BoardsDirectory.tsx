"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readRecentBoards } from "../lib/boardHistory";
import {
  BoardMode,
  DEFAULT_BUS_BOARD_LOCATIONS,
  DEFAULT_RAIL_BOARD_LOCATIONS,
  PlannerLocation,
  RecentBoardEntry,
  SearchResponse,
  buildBoardHref,
  filterSearchResultsForBoardMode,
  formatPlannerLocationLabel,
  getApiBaseUrl,
} from "../lib/transportApi";

type BoardsDirectoryProps = {
  initialMode?: BoardMode;
};

function matchesLocationQuery(location: PlannerLocation, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [location.name, location.localityName ?? "", location.code]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function getBoardSecondaryText(location: PlannerLocation, mode: BoardMode) {
  if (mode === "rail") {
    return location.code;
  }

  return location.localityName ?? "Scheduled stop board";
}

export default function BoardsDirectory({ initialMode = "bus" }: BoardsDirectoryProps) {
  const [mode, setMode] = useState<BoardMode>(initialMode);
  const [query, setQuery] = useState("");
  const [recentBoards, setRecentBoards] = useState<RecentBoardEntry[]>([]);
  const [searchResults, setSearchResults] = useState<PlannerLocation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refresh = () => setRecentBoards(readRecentBoards());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/search?q=${encodeURIComponent(trimmed)}&limit=20${mode === "bus" ? "&scheduledOnly=true" : ""}`,
          { cache: "no-store", signal: controller.signal }
        );
        const body = (await response.json()) as SearchResponse | { error?: string };
        if (!response.ok || !("results" in body)) {
          setSearchResults([]);
          return;
        }
        setSearchResults(filterSearchResultsForBoardMode(body.results, mode));
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [mode, query]);

  const recentForMode = useMemo(
    () =>
      recentBoards.filter(
        (entry) => entry.mode === mode && matchesLocationQuery(entry.location, query)
      ),
    [mode, query, recentBoards]
  );

  const defaultLocations =
    mode === "bus" ? DEFAULT_BUS_BOARD_LOCATIONS : DEFAULT_RAIL_BOARD_LOCATIONS;

  const browseLocations = useMemo(() => {
    if (query.trim().length >= 2) {
      return searchResults.slice(0, 20);
    }

    return defaultLocations.filter((location) => matchesLocationQuery(location, query)).slice(0, 20);
  }, [defaultLocations, query, searchResults]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="rounded-[2rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_100%)] p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Board type
            </div>
            <div className="mt-3 inline-flex rounded-full border border-[var(--outline)] bg-[var(--surface-alt)] p-1 shadow-[var(--shadow-soft)]">
              {(["bus", "rail"] as const).map((candidate) => {
                const active = mode === candidate;
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setMode(candidate)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[var(--brand)] text-white shadow-[var(--shadow-soft)]"
                        : "text-[var(--brand-ink)] hover:bg-[var(--surface-alt-hover)]"
                    }`}
                  >
                    {candidate === "bus" ? "Bus boards" : "Rail boards"}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">
              Search locations
            </span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === "bus" ? "Search stop or bus station" : "Search station name"}
              className="w-full rounded-[1.5rem] border border-[var(--outline)] bg-[var(--input)] px-5 py-3.5 text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--brand)]"
            />
          </label>

          <div className="rounded-[1.5rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted)]">
            {loading
              ? "Searching location names…"
              : query.trim().length >= 2
              ? `Showing up to 20 ${mode} board matches for “${query.trim()}”.`
              : `Showing a curated list of 20 ${mode} board locations. Use search to switch to name-based lookup.`}
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_100%)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Recent
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">Recently checked boards</h2>
            </div>
            <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {recentForMode.length}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {recentForMode.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                Open a {mode} board and it will appear here for quick return access.
              </div>
            ) : (
              recentForMode.map((entry) => (
                <Link
                  key={`${entry.mode}:${entry.location.type}:${entry.location.id}`}
                  href={entry.href}
                  className="block rounded-[1.5rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-alt-hover)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-[var(--foreground)]">
                        {formatPlannerLocationLabel(entry.location)}
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {getBoardSecondaryText(entry.location, entry.mode)}
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-alt)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">
                      Recent
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_100%)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Browse
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">
                {mode === "bus" ? "Bus board locations" : "Rail board locations"}
              </h2>
            </div>
            <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {browseLocations.length}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {browseLocations.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                No matching {mode} boards were found for this location search.
              </div>
            ) : (
              browseLocations.map((location) => (
                <Link
                  key={`${location.type}:${location.id}`}
                  href={buildBoardHref(location)}
                  className="block rounded-[1.5rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-alt-hover)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-[var(--foreground)]">
                        {formatPlannerLocationLabel(location)}
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {getBoardSecondaryText(location, mode)}
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-alt)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">
                      Open
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
