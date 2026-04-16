"use client";

import { useState } from "react";
import { RailDeparturesResponse, formatShortTime } from "../lib/transportApi";
import PanelCard from "./PanelCard";

type RailDepartureListProps = {
  departures: RailDeparturesResponse["departures"];
  initialVisible?: number;
};

const DEFAULT_VISIBLE = 3;
const STEP = 5;

export default function RailDepartureList({ departures, initialVisible = DEFAULT_VISIBLE }: RailDepartureListProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisible);

  if (departures.length === 0) {
    return (
      <PanelCard eyebrow="No departures" title="Nothing matched this time window">
        <p className="text-sm text-[var(--muted)]">No departures were returned for the requested station and time window.</p>
      </PanelCard>
    );
  }

  const visible = departures.slice(0, visibleCount);
  const remaining = departures.length - visibleCount;

  return (
    <div className="space-y-4">
      {visible.map((departure) => (
        <PanelCard
          key={`${departure.scheduleId}:${departure.stopId}`}
          eyebrow="Rail leg"
          title={departure.destination ?? "Destination unavailable"}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="app-stat-tile min-w-[118px]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departs</div>
                <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">
                  {departure.scheduledDeparture ?? departure.scheduledDepartureRaw ?? "Unknown"}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-lg font-semibold text-[var(--foreground)]">{departure.destination ?? "Destination unavailable"}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-[var(--muted)]">
                    {departure.platform ? `Platform ${departure.platform}` : "Platform TBC"}
                    {departure.operatorCode ? ` · ${departure.operatorCode}` : ""}
                  </div>
                  {departure.reliability && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                      departure.reliability.confidenceLevel === "HIGH" 
                        ? "bg-emerald-500/15 text-emerald-600" 
                        : departure.reliability.confidenceLevel === "MEDIUM"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-rose-500/15 text-rose-600"
                    }`}>
                      AI Reliability Score: {departure.reliability.confidenceLevel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-[var(--shadow-soft)]">
              Scheduled
            </div>
          </div>
        </PanelCard>
      ))}

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => Math.min(prev + STEP, departures.length))}
          className="w-full rounded-[var(--radius-card)] border border-dashed border-[var(--outline)] bg-[var(--surface-soft)] py-3 text-sm font-semibold text-[var(--brand)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-accent)]"
        >
          Show {Math.min(STEP, remaining)} more departure{Math.min(STEP, remaining) !== 1 ? "s" : ""} ({remaining} remaining)
        </button>
      ) : departures.length > initialVisible ? (
        <button
          type="button"
          onClick={() => setVisibleCount(initialVisible)}
          className="w-full rounded-[var(--radius-card)] border border-dashed border-[var(--outline)] bg-[var(--surface-soft)] py-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--outline)] hover:bg-[var(--surface)]"
        >
          Show fewer
        </button>
      ) : null}
    </div>
  );
}
