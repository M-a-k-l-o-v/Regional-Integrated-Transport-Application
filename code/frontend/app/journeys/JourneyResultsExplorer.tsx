"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PanelCard from "../components/PanelCard";
import {
  JourneyPlanResponse,
  JourneyPreference,
  buildBoardHref,
  buildJourneyLegHref,
  formatDurationMinutes,
  formatShortTime,
} from "../lib/transportApi";
import JourneyResultsMap from "./JourneyResultsMap";
import { JourneyRouteShape } from "./types";

type JourneyResultsExplorerProps = {
  itineraries: JourneyPlanResponse["itineraries"];
  routeShapes: JourneyRouteShape[];
  preference: JourneyPreference;
};

const INITIAL_VISIBLE_ROUTES = 3;

function legBadgeLabel(leg: JourneyPlanResponse["itineraries"][number]["legs"][number]): string {
  if (leg.mode === "walk") return "Walk";
  if (leg.mode === "bus") return leg.line ? `Bus ${leg.line}` : "Bus";
  return leg.line ? `Rail ${leg.line}` : "Rail";
}

function legModeLabel(leg: JourneyPlanResponse["itineraries"][number]["legs"][number]): string {
  if (leg.mode === "walk") return "Walk";
  if (leg.mode === "bus") return leg.line ? `Service ${leg.line}` : "Bus service";
  return leg.line ? `Train ${leg.line}` : "Rail service";
}

function getSelectedIndex(selectedIndex: number, visibleCount: number): number {
  if (visibleCount <= 0) return 0;
  return Math.min(selectedIndex, visibleCount - 1);
}

function buildRouteSummary(itinerary: JourneyPlanResponse["itineraries"][number]): string {
  const labels = itinerary.legs
    .map((leg) => legBadgeLabel(leg))
    .filter((label, index, values) => values.indexOf(label) === index);

  return labels.join(" · ");
}

function getPrimaryTransitLeg(itinerary: JourneyPlanResponse["itineraries"][number]) {
  return itinerary.legs.find((leg) => leg.mode !== "walk") ?? null;
}

export default function JourneyResultsExplorer({ itineraries, routeShapes, preference }: JourneyResultsExplorerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const visibleCount = expanded ? itineraries.length : Math.min(INITIAL_VISIBLE_ROUTES, itineraries.length);
  const visibleItineraries = itineraries.slice(0, visibleCount);
  const visibleShapes = routeShapes.slice(0, visibleCount);
  const activeIndex = getSelectedIndex(selectedIndex, visibleCount);
  const selectedItinerary = visibleItineraries[activeIndex] ?? null;
  const selectedShape = visibleShapes[activeIndex] ?? null;

  useEffect(() => {
    if (selectedIndex >= visibleCount) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, visibleCount]);

  const hasMoreRoutes = itineraries.length > INITIAL_VISIBLE_ROUTES;
  const selectedRouteHasMap = selectedShape?.hasMappedPath ?? false;

  const selectedTransitCount = useMemo(
    () => selectedItinerary?.legs.filter((leg) => leg.mode !== "walk").length ?? 0,
    [selectedItinerary]
  );
  const selectedPrimaryTransit = selectedItinerary ? getPrimaryTransitLeg(selectedItinerary) : null;
  const selectedRouteLabel = activeIndex === 0 ? "Best match" : `Route ${activeIndex + 1}`;

  const routeSheet = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Possible routes</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">
            {visibleItineraries.length} shown{hasMoreRoutes ? ` of ${itineraries.length}` : ""}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">
            The top route follows the selected preference. Click a route here or on the map to promote it.
          </div>
        </div>
        <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-ink)]">
          {preference.replaceAll("_", " ")}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visibleItineraries.map((itinerary, index) => {
          const isSelected = index === activeIndex;
          const primaryTransit = getPrimaryTransitLeg(itinerary);
          return (
            <button
              key={`${itinerary.departureTime}-${itinerary.arrivalTime}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`w-full rounded-[1.35rem] border p-4 text-left shadow-[var(--shadow-soft)] transition ${
                isSelected
                  ? "border-[var(--brand)] bg-[linear-gradient(180deg,var(--surface-accent)_0%,var(--surface-strong)_100%)]"
                  : "border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_100%)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--brand-ink)]">
                    {formatShortTime(itinerary.departureTime)} to {formatShortTime(itinerary.arrivalTime)}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {formatDurationMinutes(itinerary.totalMinutes)} · {itinerary.transfers} changes · {formatDurationMinutes(itinerary.walkingMinutes)} walking
                  </div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${isSelected ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-soft)] text-[var(--brand-ink)]"}`}>
                  {index === 0 ? "Best" : `Route ${index + 1}`}
                </div>
              </div>

              <div className="mt-3 text-sm font-semibold text-[var(--brand-ink)]">
                {primaryTransit ? legModeLabel(primaryTransit) : "Walk-only route"}
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">{buildRouteSummary(itinerary)}</div>
            </button>
          );
        })}
      </div>

      {hasMoreRoutes ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--muted)]">
            {expanded ? "Showing the full returned list." : `Showing the first ${visibleItineraries.length} routes.`}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center rounded-full bg-[var(--surface-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
          >
            {expanded ? "Show fewer" : "Show more"}
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="space-y-6">
      <PanelCard
        eyebrow="Route map"
        title={selectedItinerary ? `${formatShortTime(selectedItinerary.departureTime)} to ${formatShortTime(selectedItinerary.arrivalTime)}` : "Interactive route overview"}
        description={
          selectedRouteHasMap
            ? "The blue line is the active route. White lines are alternatives. Click any white route on the map or any route in the list to promote it."
            : "This result set does not contain enough mapped stop geometry to draw a route."
        }
        className="overflow-hidden"
      >
        <div className="space-y-5">
          <div className="relative">
            <JourneyResultsMap
              itineraries={visibleItineraries}
              routeShapes={visibleShapes}
              selectedIndex={activeIndex}
              onSelect={setSelectedIndex}
            />

            <div className="hidden xl:block absolute left-5 top-5 z-[700] max-h-[calc(100%-2.5rem)] w-[380px] overflow-y-auto rounded-[2rem] border border-black/10 bg-white/94 p-5 text-slate-900 shadow-[0_20px_42px_rgba(15,23,42,0.18)] backdrop-blur-sm">
              {routeSheet}
            </div>
          </div>

          <div className="xl:hidden">
            <PanelCard
              eyebrow="Possible routes"
              title={`${visibleItineraries.length} shown${hasMoreRoutes ? ` of ${itineraries.length}` : ""}`}
              description="The top route follows the selected preference. Pick any option here or click a white route on the map to make it the active route."
            >
              {routeSheet}
            </PanelCard>
          </div>
        </div>
      </PanelCard>

      {selectedItinerary ? (
        <PanelCard
          eyebrow="Selected route"
          title={`${formatShortTime(selectedItinerary.departureTime)} to ${formatShortTime(selectedItinerary.arrivalTime)}`}
          description="This is the currently active route. Its map line is blue and its full leg breakdown is shown below."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="app-stat-tile">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Selected</div>
              <div className="mt-2 text-lg font-semibold text-[var(--brand-ink)]">{selectedRouteLabel}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{preference.replaceAll("_", " ")}</div>
            </div>
            <div className="app-stat-tile">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Duration</div>
              <div className="mt-2 text-lg font-semibold text-[var(--brand-ink)]">{formatDurationMinutes(selectedItinerary.totalMinutes)}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{selectedItinerary.transfers} changes</div>
            </div>
            <div className="app-stat-tile">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Walking</div>
              <div className="mt-2 text-lg font-semibold text-[var(--brand-ink)]">{formatDurationMinutes(selectedItinerary.walkingMinutes)}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{selectedTransitCount} transit legs</div>
            </div>
            <div className="app-stat-tile">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Main service</div>
              <div className="mt-2 text-lg font-semibold text-[var(--brand-ink)]">
                {selectedPrimaryTransit ? legModeLabel(selectedPrimaryTransit) : "Walk only"}
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {selectedPrimaryTransit?.operator ?? "No transit service in this itinerary"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Route breakdown</div>
              <div className="mt-2 text-sm text-[var(--muted)]">
                {buildRouteSummary(selectedItinerary)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItinerary.legs
                .filter((leg) => leg.mode !== "walk")
                .slice(0, 3)
                .map((leg, legIndex) => (
                  <span key={`${leg.mode}-${legIndex}-${leg.from.id}-${leg.to.id}-summary`} className="app-pill">
                    {legBadgeLabel(leg)}
                  </span>
                ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {selectedItinerary.legs.map((leg, legIndex) => (
              <div key={`${leg.mode}-${legIndex}-${leg.from.id}-${leg.to.id}-selected`} className="app-list-card">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="inline-flex rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-ink)]">
                      {leg.mode}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {leg.from.name} to {leg.to.name}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {formatShortTime(leg.departureTime)} to {formatShortTime(leg.arrivalTime)}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--brand-ink)]">{legModeLabel(leg)}</div>
                    {leg.operator ? <div className="mt-1 text-sm text-[var(--muted)]">{leg.operator}</div> : null}
                  </div>

                  {leg.mode !== "walk" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={buildJourneyLegHref(leg)}
                        className="inline-flex items-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)]"
                      >
                        View route
                      </Link>
                      <Link
                        href={buildBoardHref(leg.from)}
                        className="inline-flex items-center rounded-full bg-[var(--surface-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
                      >
                        Open board
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      ) : null}
    </div>
  );
}
