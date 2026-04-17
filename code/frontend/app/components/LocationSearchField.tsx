"use client";

import { useEffect, useRef, useState } from "react";
import {
  getApiBaseUrl,
  PlannerLocation,
  SearchResponse,
  SearchResult,
  TransitModeFilter,
} from "../lib/transportApi";

type LocationSearchFieldProps = {
  label: string;
  placeholder: string;
  value: PlannerLocation | null;
  onChange: (value: PlannerLocation | null) => void;
  transitModes: TransitModeFilter[];
  showCodeInLabel?: boolean;
  scheduledOnly?: boolean;
};

function formatFieldLabel(location: PlannerLocation | null, showCodeInLabel: boolean): string {
  if (!location) return "";
  const locality = location.localityName?.trim();
  const label = locality ? `${location.name}, ${locality}` : location.name;
  if (location.type === "bus_stop_group") return label;
  return showCodeInLabel ? `${label} (${location.code})` : label;
}

function toPlannerLocation(result: SearchResult): PlannerLocation {
  return {
    type: result.type,
    id: result.id,
    code: result.code,
    name: result.name,
    localityName: result.localityName,
  };
}

export default function LocationSearchField({
  label,
  placeholder,
  value,
  onChange,
  transitModes,
  showCodeInLabel = true,
  scheduledOnly = false,
}: LocationSearchFieldProps) {
  const [query, setQuery] = useState(formatFieldLabel(value, showCodeInLabel));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setQuery(formatFieldLabel(value, showCodeInLabel));
  }, [showCodeInLabel, value?.id, value?.name, value?.code, value?.localityName]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set("q", trimmed);
        searchParams.set("limit", "8");
        if (transitModes.length === 1) {
          searchParams.set("transitMode", transitModes[0])
        }
        if (scheduledOnly) {
          searchParams.set("scheduledOnly", "true");
        }

        const response = await fetch(`${getApiBaseUrl()}/search?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as SearchResponse | { error?: string };
        if (!response.ok || !("results" in body)) {
          setResults([]);
          return;
        }
        setResults(body.results);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
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
  }, [query, transitModes, scheduledOnly]);

  function selectResult(result: SearchResult) {
    const selected = toPlannerLocation(result);
    onChange(selected);
    setQuery(formatFieldLabel(selected, showCodeInLabel));
    setOpen(false);
    setResults([]);
  }

  return (
    <label className="relative block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setOpen(true);
          if (!value || nextValue !== formatFieldLabel(value, showCodeInLabel)) {
            onChange(null);
          }
        }}
      />

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-[var(--outline)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          {loading ? (
            <div className="px-4 py-3 text-sm text-[var(--muted)]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--muted)]">Enter at least 2 characters to search.</div>
          ) : (
            results.map((result) => (
              <button
                key={`${result.type}:${result.id}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 border-b border-[var(--outline-soft)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[var(--surface-soft)]"
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (blurTimeoutRef.current) {
                    window.clearTimeout(blurTimeoutRef.current);
                  }
                  selectResult(result);
                }}
              >
                <div>
                  <div className="font-semibold text-[var(--foreground)]">{result.name}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {[result.localityName, result.type === "bus_stop_group" ? null : result.code].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)]">
                  {result.type === "station" ? "Rail" : result.type === "bus_stop_group" ? "Bus hub" : "Bus"}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </label>
  );
}
