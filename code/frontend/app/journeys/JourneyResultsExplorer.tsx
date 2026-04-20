"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PanelCard from "../components/PanelCard";
import {
  JourneyLegDetailResponse,
  JourneyPlanResponse,
  JourneyPreference,
  StationFacilities,
  StationFacilitiesResponse,
  buildBoardHref,
  buildJourneyLegHref,
  formatDurationMinutes,
  formatShortTime,
  getApiBaseUrl,
} from "../lib/transportApi";
import JourneyResultsMap from "./JourneyResultsMap";
import LiveVehicleTracker, { LiveTrackingState } from "./LiveVehicleTracker";
import { JourneyRouteShape } from "./types";

type JourneyResultsExplorerProps = {
  itineraries: JourneyPlanResponse["itineraries"];
  routeShapes: JourneyRouteShape[];
  preference: JourneyPreference;
  legDetails?: Record<string, JourneyLegDetailResponse>;
};

const ROUTES_PER_PAGE = 5;
const MAX_ROUTES = 50;

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

function owmIconToEmoji(code: string | null): string {
  if (!code) return "🌤";
  const base = code.replace(/[dn]$/, "");
  switch (base) {
    case "01": return "☀️";
    case "02": return "⛅";
    case "03": return "☁️";
    case "04": return "☁️";
    case "09": return "🌧";
    case "10": return "🌦";
    case "11": return "⛈";
    case "13": return "🌨";
    case "50": return "🌫";
    default: return "🌤";
  }
}

function getLegKey(leg: JourneyPlanResponse["itineraries"][number]["legs"][number]): string | null {
  if (leg.mode === "walk" || !leg.scheduleId) return null;
  return `${leg.mode}:${leg.scheduleId}:${leg.from.id}:${leg.to.id}`;
}

function getItineraryDelayMinutes(itinerary: JourneyPlanResponse["itineraries"][number]): number | null {
  const delays = itinerary.legs
    .map((leg) => leg.liveDelayMinutes)
    .filter((d): d is number => d !== null);
  if (delays.length === 0) return null;
  return Math.max(...delays);
}

function hasBankHolidayAdvisory(itinerary: JourneyPlanResponse["itineraries"][number]): boolean {
  return itinerary.legs.some((leg) => leg.bankHolidayAdvisory === true);
}

function getAvailableServices(items: JourneyPlanResponse["itineraries"]): string[] {
  const counts = new Map<string, number>();
  for (const itinerary of items) {
    const seen = new Set<string>();
    for (const leg of itinerary.legs) {
      if (leg.mode !== "walk" && leg.line && !seen.has(leg.line)) {
        seen.add(leg.line);
        counts.set(leg.line, (counts.get(leg.line) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([line]) => line);
}

function itineraryUsesService(itinerary: JourneyPlanResponse["itineraries"][number], service: string): boolean {
  return itinerary.legs.some((leg) => leg.mode !== "walk" && leg.line === service);
}

// function countFacilityAmenities(f: StationFacilities): number {
//   let count = 0;
//   if (f.accessibility.stepFreeAccess === "full") count += 3;
//   else if (f.accessibility.stepFreeAccess === "partial") count += 1;
//   if (f.accessibility.lift) count++;
//   if (f.accessibility.accessibleToilet) count++;
//   if (f.accessibility.wheelchairAvailable) count++;
//   if (f.ticketOffice.available) count++;
//   if (f.ticketOffice.ticketMachine) count++;
//   if (f.parking.available) count++;
//   if (f.toilets.available) count++;
//   if (f.amenities.wifi) count++;
//   if (f.amenities.waitingRoom) count++;
//   if (f.amenities.cafe) count++;
//   if (f.amenities.bikeStorage) count++;
//   if (f.amenities.taxiRank) count++;
//   if (f.amenities.customerHelpPoint) count++;
//   return count;
// }

type SortMode = "default" | "amenities";

export default function JourneyResultsExplorer({ itineraries, routeShapes, preference, legDetails }: JourneyResultsExplorerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(ROUTES_PER_PAGE);
  const [liveTracking, setLiveTracking] = useState<LiveTrackingState | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [amenityScores, setAmenityScores] = useState<Map<number, number>>(new Map());
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);
  const [sheetDismissing, setSheetDismissing] = useState(false);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const dismissSheet = useCallback(() => {
    setSheetDismissing(true);
    setTimeout(() => {
      setDetailOpen(false);
      setSheetDismissing(false);
    }, 200);
  }, []);

  // Keyboard: Escape to dismiss
  useEffect(() => {
    if (!detailOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissSheet();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailOpen, dismissSheet]);

  const legDetailsMap = useMemo(() => {
    if (!legDetails) return new Map<string, JourneyLegDetailResponse>();
    return new Map(Object.entries(legDetails));
  }, [legDetails]);

  const handleLiveUpdate = useCallback((state: LiveTrackingState) => {
    setLiveTracking(state);
  }, []);

  const availableServices = useMemo(() => getAvailableServices(itineraries), [itineraries]);

  // Fetch amenity scores for all rail stations across itineraries
  const loadAmenityScores = useCallback(async () => {
    setAmenitiesLoading(true);
    const stationCodes = new Set<string>();
    for (const itin of itineraries) {
      for (const leg of itin.legs) {
        if (leg.mode === "rail") {
          if (leg.from.type === "station") stationCodes.add(leg.from.code);
          if (leg.to.type === "station") stationCodes.add(leg.to.code);
        }
      }
    }

    const facilityMap = new Map<string, number>();
    await Promise.all(
      Array.from(stationCodes).map(async (code) => {
        try {
          const res = await fetch(`${getApiBaseUrl()}/rail/stations/${encodeURIComponent(code)}/facilities`, { cache: "no-store" });
          if (res.ok) {
            const data: StationFacilitiesResponse = await res.json();
            // if (data.facilities) facilityMap.set(code, countFacilityAmenities(data.facilities));
          }
        } catch { /* ignore */ }
      })
    );

    const scores = new Map<number, number>();
    itineraries.forEach((itin, idx) => {
      let total = 0;
      for (const leg of itin.legs) {
        if (leg.mode === "rail") {
          total += facilityMap.get(leg.from.code) ?? 0;
          total += facilityMap.get(leg.to.code) ?? 0;
        }
      }
      scores.set(idx, total);
    });

    setAmenityScores(scores);
    setAmenitiesLoading(false);
  }, [itineraries]);

  // Load amenity data when user switches to amenities sort
  useEffect(() => {
    if (sortMode === "amenities" && amenityScores.size === 0 && !amenitiesLoading) {
      void loadAmenityScores();
    }
  }, [sortMode, amenityScores.size, amenitiesLoading, loadAmenityScores]);

  // Build filtered + sorted + paginated view
  const filteredIndices = useMemo(() => {
    let indices = itineraries.map((_, i) => i);
    if (serviceFilter) {
      indices = indices.filter((i) => itineraryUsesService(itineraries[i], serviceFilter));
    }
    if (sortMode === "amenities" && amenityScores.size > 0) {
      indices.sort((a, b) => (amenityScores.get(b) ?? 0) - (amenityScores.get(a) ?? 0));
    }
    return indices;
  }, [itineraries, serviceFilter, sortMode, amenityScores]);

  const cappedTotal = Math.min(filteredIndices.length, MAX_ROUTES);
  const visibleCount = Math.min(visibleLimit, cappedTotal);
  const visibleOriginalIndices = filteredIndices.slice(0, visibleCount);
  const visibleItineraries = visibleOriginalIndices.map((i) => itineraries[i]);
  const visibleShapes = visibleOriginalIndices.map((i) => routeShapes[i]);
  const activeIndex = getSelectedIndex(selectedIndex, visibleCount);
  const selectedOriginalIndex = visibleOriginalIndices[activeIndex] ?? 0;
  const selectedItinerary = visibleItineraries[activeIndex] ?? null;
  const selectedShape = visibleShapes[activeIndex] ?? null;

  useEffect(() => {
    if (selectedIndex >= visibleCount) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, visibleCount]);

  // Reset pagination + selection when filter/sort changes
  useEffect(() => {
    setSelectedIndex(0);
    setVisibleLimit(ROUTES_PER_PAGE);
  }, [serviceFilter, sortMode]);

  const hasMoreRoutes = visibleCount < cappedTotal;
  const selectedRouteHasMap = selectedShape?.hasMappedPath ?? false;

  const selectedTransitCount = useMemo(
    () => selectedItinerary?.legs.filter((leg) => leg.mode !== "walk").length ?? 0,
    [selectedItinerary]
  );
  const selectedPrimaryTransit = selectedItinerary ? getPrimaryTransitLeg(selectedItinerary) : null;
  const selectedRouteLabel = activeIndex === 0 ? "Best match" : `Route ${activeIndex + 1}`;

  const renderRouteSheet = (tone: "light" | "default") => {
    const isLight = tone === "light";
    const headerText = isLight ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-[var(--muted)]";
    const countText = isLight ? "text-sm font-bold text-slate-900" : "text-sm font-bold text-[var(--foreground)]";
    const badgeClass = isLight
      ? "rounded-full bg-emerald-600 px-2.5 py-0.5 text-[0.65rem] font-semibold text-white"
      : "rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-[0.65rem] font-semibold text-[var(--muted)]";
    const cardClass = (selected: boolean) =>
      isLight
        ? `w-full rounded-lg border px-3 py-2.5 text-left transition ${selected ? "border-emerald-400 bg-white ring-1 ring-emerald-200/60" : "border-slate-200 bg-white/80 hover:border-slate-300"}`
        : `w-full rounded-lg border px-3 py-2.5 text-left transition ${selected ? "border-[var(--brand)] bg-[var(--surface-accent)]" : "border-[var(--outline)] bg-[var(--surface)] hover:border-[var(--brand)]/40"}`;
    const titleClass = isLight ? "text-sm font-bold text-slate-900" : "text-sm font-bold text-[var(--foreground)]";
    const metaClass = isLight ? "text-xs text-slate-500" : "text-xs text-[var(--muted)]";
    const serviceClass = isLight ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-[var(--brand)]";
    const pillClass = (selected: boolean) =>
      isLight
        ? `shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`
        : `shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${selected ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-soft)] text-[var(--muted)]"}`;
    const viewMoreClass = isLight
      ? "w-full rounded-lg border border-dashed border-slate-300 py-2 text-center text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
      : "w-full rounded-lg border border-dashed border-[var(--outline)] py-2 text-center text-xs font-semibold text-[var(--brand)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-accent)]";

    return (
      <>
        {/* Compact header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={countText}>{visibleCount} of {cappedTotal}</span>
            <span className={badgeClass}>{preference.replaceAll("_", " ")}</span>
          </div>
          <span className={headerText}>Tap to select</span>
        </div>

        {/* Service filter pills */}
        {availableServices.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setServiceFilter(null)}
              className={isLight
                ? `rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition ${serviceFilter === null ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300"}`
                : `rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition ${serviceFilter === null ? "border-[var(--brand)] bg-[var(--surface-accent)] text-[var(--brand)]" : "border-[var(--outline)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)]/40"}`
              }
            >
              All
            </button>
            {availableServices.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => setServiceFilter(serviceFilter === line ? null : line)}
                className={isLight
                  ? `rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition ${serviceFilter === line ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300"}`
                  : `rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition ${serviceFilter === line ? "border-[var(--brand)] bg-[var(--surface-accent)] text-[var(--brand)]" : "border-[var(--outline)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)]/40"}`
                }
              >
                {line}
              </button>
            ))}
            {/* <span className={isLight ? "mx-0.5 w-px bg-slate-200" : "mx-0.5 w-px bg-[var(--outline)]"} />
            <button
              type="button"
              onClick={() => setSortMode(sortMode === "amenities" ? "default" : "amenities")}
              className={isLight
                ? `rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition ${sortMode === "amenities" ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300"}`
                : `rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold transition ${sortMode === "amenities" ? "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300" : "border-[var(--outline)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)]/40"}`
              }
            >
              {amenitiesLoading ? "Loading…" : "Most amenities"}
            </button> */}
          </div>
        ) : null}

        {/* Scrollable route list */}
        <div className="mt-2 max-h-[420px] space-y-1.5 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {visibleItineraries.map((itinerary, index) => {
            const isSelected = index === activeIndex;
            const originalIdx = visibleOriginalIndices[index];
            const primaryTransit = getPrimaryTransitLeg(itinerary);
            const maxDelay = getItineraryDelayMinutes(itinerary);
            const bankHolidayAffected = hasBankHolidayAdvisory(itinerary);
            const amenityScore = amenityScores.get(originalIdx) ?? null;
            return (
              <button
                key={`${itinerary.departureTime}-${itinerary.arrivalTime}-${index}`}
                type="button"
                onClick={() => { setSelectedIndex(index); setDetailOpen(true); }}
                className={cardClass(isSelected)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={titleClass}>
                        {formatShortTime(itinerary.departureTime)} – {formatShortTime(itinerary.arrivalTime)}
                      </span>
                      <span className={metaClass}>{itinerary.totalMinutes}m · {itinerary.transfers}ch</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={serviceClass}>
                        {primaryTransit ? legBadgeLabel(primaryTransit) : "Walk"}
                      </span>
                      {maxDelay !== null && maxDelay > 1 && (
                        <span className="text-[0.65rem] font-semibold text-amber-500">+{maxDelay}m</span>
                      )}
                      {bankHolidayAffected && (
                        <span className="text-[0.65rem] font-semibold text-yellow-500">Holiday</span>
                      )}
                      {/* {sortMode === "amenities" && amenityScore !== null && amenityScore > 0 && (
                        <span className="text-[0.65rem] font-semibold text-violet-500">{amenityScore} amenities</span>
                      )} */}
                    </div>
                  </div>
                  <span className={pillClass(isSelected)}>{index === 0 ? "Best" : index + 1}</span>
                </div>
              </button>
            );
          })}

          {/* View more */}
          {hasMoreRoutes ? (
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => Math.min(prev + ROUTES_PER_PAGE, MAX_ROUTES))}
              className={viewMoreClass}
            >
              View more routes ({Math.min(ROUTES_PER_PAGE, cappedTotal - visibleCount)} more)
            </button>
          ) : null}
        </div>
      </>
    );
  };

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
              liveTracking={liveTracking}
            />

            <div className="hidden xl:block absolute left-5 top-5 z-[700] max-h-[calc(100%-2.5rem)] w-[380px] overflow-y-auto rounded-2xl border border-slate-200 bg-white/97 p-5 text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-sm">
              {renderRouteSheet("light")}
            </div>
          </div>

          <div className="xl:hidden">
            <PanelCard
              eyebrow="Possible routes"
              title={`${visibleItineraries.length} shown${hasMoreRoutes ? ` of ${itineraries.length}` : ""}`}
              description="The top route follows the selected preference. Pick any option here or click a white route on the map to make it the active route."
            >
              {renderRouteSheet("default")}
            </PanelCard>
          </div>
        </div>
      </PanelCard>

      {/* ── Route detail modal ────────────────────────────────────────── */}
      {detailOpen && selectedItinerary ? (
        <>
          <div
            className={`fixed inset-0 z-[900] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${sheetDismissing ? "opacity-0" : "opacity-100"}`}
            onClick={dismissSheet}
            role="presentation"
            aria-hidden="true"
          />

          <div className="fixed inset-0 z-[901] flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Route details"
              className={`pointer-events-auto flex h-[80vh] w-full max-w-[53.3vh] flex-col overflow-hidden rounded-[2rem] border border-[var(--outline)] bg-[var(--surface-strong)] shadow-[0_32px_80px_rgba(0,0,0,0.35)] ${sheetDismissing ? "scale-95 opacity-0 transition-all duration-200" : "animate-[modalPopIn_0.25s_ease-out]"}`}
            >
            {/* Modal Header */}
            <div className="shrink-0 px-6 pt-5">
              <div className="flex items-center justify-between border-b border-[var(--outline)] pb-4">
                <button
                  type="button"
                  onClick={dismissSheet}
                  className="rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                >
                  Close
                </button>
                <span className="text-sm font-bold uppercase tracking-wider text-[var(--brand-ink)]">
                  Route details
                </span>
                <span className="text-sm font-semibold text-[var(--brand)]">
                  {selectedRouteLabel}
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div ref={sheetScrollRef} className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
              {/* Time header */}
              <div className="mb-4 text-center">
                <div className="text-2xl font-bold text-[var(--foreground)]">
                  {formatShortTime(selectedItinerary.departureTime)} – {formatShortTime(selectedItinerary.arrivalTime)}
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">{buildRouteSummary(selectedItinerary)}</div>
              </div>

              {/* Mini stat boxes – 2×2 grid */}
              <div className="mb-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-lg font-bold text-[var(--brand-ink)]">{formatDurationMinutes(selectedItinerary.totalMinutes)}</div>
                  <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Duration</div>
                </div>
                <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-lg font-bold text-[var(--brand-ink)]">{selectedItinerary.transfers}</div>
                  <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Changes</div>
                </div>
                <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-lg font-bold text-[var(--brand-ink)]">{formatDurationMinutes(selectedItinerary.walkingMinutes)}</div>
                  <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Walking</div>
                </div>
                <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-lg font-bold text-[var(--brand-ink)]">
                    {selectedPrimaryTransit ? (selectedPrimaryTransit.line ?? selectedPrimaryTransit.mode) : "Walk"}
                  </div>
                  <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Main service</div>
                </div>
              </div>

              {/* Service pills */}
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedItinerary.legs
                  .filter((leg) => leg.mode !== "walk")
                  .slice(0, 4)
                  .map((leg, legIndex) => (
                    <span key={`${leg.mode}-${legIndex}-${leg.from.id}-${leg.to.id}-pill`} className="app-pill">
                      {legBadgeLabel(leg)}
                    </span>
                  ))}
                {selectedPrimaryTransit?.operator ? (
                  <span className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                    {selectedPrimaryTransit.operator}
                  </span>
                ) : null}
              </div>

              {/* Leg breakdown */}
              <div className="space-y-3">
                {selectedItinerary.legs.map((leg, legIndex) => (
                  <div key={`${leg.mode}-${legIndex}-${leg.from.id}-${leg.to.id}-detail`} className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Mode + status badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--brand-ink)]">
                            {leg.mode}
                          </span>
                          {leg.liveDelayMinutes !== null && leg.liveDelayMinutes > 1 && (
                            <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.65rem] font-semibold text-amber-600">
                              +{leg.liveDelayMinutes} min late
                            </span>
                          )}
                          {leg.liveDelayMinutes !== null && leg.liveDelayMinutes <= 0 && (
                            <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[0.65rem] font-semibold text-emerald-600">
                              On time
                            </span>
                          )}
                          {leg.bankHolidayAdvisory && (
                            <span className="inline-flex rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-[0.65rem] font-semibold text-yellow-600">
                              Holiday
                            </span>
                          )}
                          {leg.reliability && (
                            <span 
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold ${
                                leg.reliability.confidenceLevel === "HIGH" 
                                  ? "bg-emerald-500/15 text-emerald-600" 
                                  : leg.reliability.confidenceLevel === "MEDIUM"
                                    ? "bg-amber-500/15 text-amber-600"
                                    : "bg-rose-500/15 text-rose-600"
                              }`}
                              title="Experimental in-house AI model. Accuracy is not guaranteed."                            
                              >
                              AI Reliability Score: {leg.reliability.confidenceLevel}
                              <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                          )}
                        </div>

                        {/* Route info */}
                        <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {leg.from.name} to {leg.to.name}
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {leg.liveDelayMinutes !== null && leg.liveDelayMinutes > 1 && leg.scheduledDepartureTime ? (
                            <>
                              <span className="line-through opacity-50">{formatShortTime(leg.scheduledDepartureTime)}</span>
                              <span className="ml-1 font-semibold text-amber-600">{formatShortTime(leg.departureTime)}</span>
                            </>
                          ) : (
                            formatShortTime(leg.departureTime)
                          )}
                          {" to "}
                          {formatShortTime(leg.arrivalTime)}
                        </div>
                        <div className="mt-1.5 text-xs font-semibold text-[var(--brand-ink)]">{legModeLabel(leg)}</div>
                        {leg.operator ? <div className="mt-0.5 text-xs text-[var(--muted)]">{leg.operator}</div> : null}

                        {/* Weather & disruption advisories from leg detail */}
                        {(() => {
                          const key = getLegKey(leg);
                          const detail = key ? legDetailsMap.get(key) : null;
                          if (!detail) return null;
                          const { weather, disruptions, delays } = detail.status;
                          const hasAdvisory = weather.available || (disruptions.available && disruptions.items.length > 0) || (delays.available && delays.cancellationFlag);
                          if (!hasAdvisory) return null;
                          return (
                            <div className="mt-2.5 space-y-1.5">
                              {weather.available && weather.description ? (
                                <div className="flex items-start gap-2 rounded-lg bg-sky-500/10 px-2.5 py-1.5">
                                  <span className="mt-0.5 text-sm">{owmIconToEmoji(weather.icon)}</span>
                                  <div>
                                    <div className="text-[0.65rem] font-semibold text-sky-700">Weather</div>
                                    <div className="text-xs text-sky-800">
                                      {weather.description}
                                      {weather.temperatureC !== null ? ` · ${weather.temperatureC}°C` : ""}
                                      {weather.windSpeedMps !== null ? ` · Wind ${(weather.windSpeedMps * 2.237).toFixed(0)} mph` : ""}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                              {disruptions.available && disruptions.items.length > 0 ? (
                                disruptions.items.map((item, dIdx) => (
                                  <div key={dIdx} className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-2.5 py-1.5">
                                    <span className="mt-0.5 text-sm">⚠</span>
                                    <div>
                                      <div className="text-[0.65rem] font-semibold text-rose-700">{item.type}</div>
                                      <div className="text-xs text-rose-800">{item.description}</div>
                                    </div>
                                  </div>
                                ))
                              ) : null}
                              {delays.available && delays.cancellationFlag ? (
                                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-2.5 py-1.5">
                                  <span className="mt-0.5 text-sm">🚫</span>
                                  <div>
                                    <div className="text-[0.65rem] font-semibold text-red-700">Cancelled</div>
                                    <div className="text-xs text-red-800">{delays.summary ?? "This service has been cancelled"}</div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Action buttons */}
                      {leg.mode !== "walk" ? (
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <Link
                            href={`${buildJourneyLegHref(leg)}&returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/journeys")}`}
                            className="inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-3.5 py-2 text-xs font-semibold text-white shadow-[var(--shadow-soft)]"
                          >
                            View route
                          </Link>
                          <Link
                            href={buildBoardHref(leg.from)}
                            className="inline-flex items-center justify-center rounded-xl bg-[var(--surface-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
                          >
                            Open board
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* Live vehicle tracking inside the sheet */}
              {selectedItinerary.legs.some((leg) => leg.mode === "bus") ? (
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Live tracking</div>
                  <div className="mt-2">
                    <LiveVehicleTracker
                      itinerary={selectedItinerary}
                      legDetails={legDetailsMap}
                      onUpdate={handleLiveUpdate}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
