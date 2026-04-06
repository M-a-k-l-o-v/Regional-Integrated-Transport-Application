"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BusLiveResponse,
  JourneyLegDetailResponse,
  JourneyPlanResponse,
  fetchJson,
  formatShortTime,
} from "../lib/transportApi";

type Leg = JourneyPlanResponse["itineraries"][number]["legs"][number];

type TrackedVehicle = {
  vehicleRef: string | null;
  lineLabel: string;
  latitude: number;
  longitude: number;
  bearing: number | null;
  destinationName: string | null;
  delayMinutes: number | null;
  monitored: boolean;
  recordedAtTime: string | null;
  nearestStopIndex: number | null;
  nearestStopName: string | null;
  nextStopIndex: number | null;
  nextStopName: string | null;
  nextStopEta: string | null;
};

type StopPoint = {
  name: string;
  latitude: number;
  longitude: number;
  departureTime: string | null;
  arrivalTime: string | null;
};

export type LiveTrackingState = {
  vehicles: TrackedVehicle[];
  legLine: string | null;
  loading: boolean;
  lastUpdated: string | null;
};

type LiveVehicleTrackerProps = {
  itinerary: JourneyPlanResponse["itineraries"][number] | null;
  legDetails: Map<string, JourneyLegDetailResponse>;
  onUpdate?: (state: LiveTrackingState) => void;
};

const KNOWN_LANCASHIRE_OPERATORS = ["LNCS", "PC", "ANW", "GONW"];
const POLL_INTERVAL_MS = 15_000;

function getLegKey(leg: Leg): string | null {
  if (leg.mode === "walk" || !leg.scheduleId) return null;
  return `${leg.mode}:${leg.scheduleId}:${leg.from.id}:${leg.to.id}`;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStop(
  lat: number,
  lon: number,
  stops: StopPoint[]
): { index: number; distance: number } | null {
  if (stops.length === 0) return null;
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const d = distanceKm(lat, lon, stops[i].latitude, stops[i].longitude);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distance: bestDist };
}

function estimateEta(
  nearestIndex: number,
  nextIndex: number,
  stops: StopPoint[]
): string | null {
  const nextStop = stops[nextIndex];
  if (!nextStop) return null;
  const time = nextStop.arrivalTime ?? nextStop.departureTime;
  return time;
}

function extractStopsFromDetail(detail: JourneyLegDetailResponse): StopPoint[] {
  return detail.path.points
    .filter(
      (p): p is typeof p & { latitude: number; longitude: number } =>
        p.latitude !== null && p.longitude !== null
    )
    .map((p) => ({
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      departureTime: p.departureTime,
      arrivalTime: p.arrivalTime,
    }));
}

export default function LiveVehicleTracker({
  itinerary,
  legDetails,
  onUpdate,
}: LiveVehicleTrackerProps) {
  const [state, setState] = useState<LiveTrackingState>({
    vehicles: [],
    legLine: null,
    loading: false,
    lastUpdated: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const primaryBusLeg = useMemo(() => {
    if (!itinerary) return null;
    return itinerary.legs.find((leg) => leg.mode === "bus" && leg.line) ?? null;
  }, [itinerary]);

  const legStops = useMemo(() => {
    if (!primaryBusLeg) return [];
    const key = getLegKey(primaryBusLeg);
    if (!key) return [];
    const detail = legDetails.get(key);
    if (!detail) return [];
    return extractStopsFromDetail(detail);
  }, [primaryBusLeg, legDetails]);

  const lineLabel = primaryBusLeg?.line ?? null;

  const fetchLiveData = useCallback(async () => {
    if (!lineLabel) {
      setState({ vehicles: [], legLine: null, loading: false, lastUpdated: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    const allVehicles: BusLiveResponse["vehicles"] = [];
    await Promise.all(
      KNOWN_LANCASHIRE_OPERATORS.map(async (opId) => {
        const { data } = await fetchJson<BusLiveResponse>(`/bus/live/${encodeURIComponent(opId)}`);
        if (data) allVehicles.push(...data.vehicles);
      })
    );

    const normalizedLine = lineLabel.trim().toUpperCase();
    const matched = allVehicles.filter((v) => {
      const vLine = (v.publishedLineName ?? v.lineRef ?? "").trim().toUpperCase();
      return vLine === normalizedLine && v.latitude !== null && v.longitude !== null;
    });

    const tracked: TrackedVehicle[] = matched.map((v) => {
      const lat = v.latitude!;
      const lon = v.longitude!;
      const nearest = findNearestStop(lat, lon, legStops);
      const nearestIdx = nearest?.index ?? null;
      const nextIdx =
        nearestIdx !== null && nearestIdx < legStops.length - 1 ? nearestIdx + 1 : null;

      return {
        vehicleRef: v.vehicleRef,
        lineLabel: (v.publishedLineName ?? v.lineRef ?? lineLabel).trim(),
        latitude: lat,
        longitude: lon,
        bearing: v.bearing,
        destinationName: v.destinationName,
        delayMinutes: v.monitoredCallDelayMinutes ?? null,
        monitored: v.monitored === true,
        recordedAtTime: v.recordedAtTime,
        nearestStopIndex: nearestIdx,
        nearestStopName: nearestIdx !== null ? legStops[nearestIdx]?.name ?? null : null,
        nextStopIndex: nextIdx,
        nextStopName: nextIdx !== null ? legStops[nextIdx]?.name ?? null : null,
        nextStopEta:
          nearestIdx !== null && nextIdx !== null
            ? estimateEta(nearestIdx, nextIdx, legStops)
            : null,
      };
    });

    const newState: LiveTrackingState = {
      vehicles: tracked,
      legLine: lineLabel,
      loading: false,
      lastUpdated: new Date().toISOString(),
    };
    setState(newState);
    onUpdate?.(newState);
  }, [lineLabel, legStops, onUpdate]);

  useEffect(() => {
    fetchLiveData();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchLiveData, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLiveData]);

  if (!primaryBusLeg || !lineLabel) return null;

  const { vehicles, loading, lastUpdated } = state;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${vehicles.length > 0 ? "animate-pulse bg-emerald-500" : "bg-[var(--muted)]"}`} />
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Live tracking · Service {lineLabel}
          </span>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {loading ? "Updating..." : vehicles.length > 0 ? `${vehicles.length} vehicle${vehicles.length !== 1 ? "s" : ""} found` : "No vehicles found"}
        </span>
      </div>

      {/* Vehicle cards */}
      {vehicles.length === 0 && !loading ? (
        <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          No live vehicles currently tracked for Service {lineLabel}. The bus may not have started yet or live tracking is unavailable.
        </div>
      ) : (
        vehicles.map((vehicle, idx) => (
          <div
            key={vehicle.vehicleRef ?? `v-${idx}`}
            className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-xs font-bold text-white">
                  {vehicle.lineLabel}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {vehicle.destinationName ?? "In service"}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {vehicle.monitored ? "GPS tracked" : "Scheduled position"}
                    {vehicle.vehicleRef ? ` · ${vehicle.vehicleRef}` : ""}
                  </div>
                </div>
              </div>
              {/* Delay badge */}
              {vehicle.delayMinutes !== null ? (
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    vehicle.delayMinutes <= 1
                      ? "bg-emerald-500/15 text-emerald-600"
                      : vehicle.delayMinutes <= 5
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-rose-500/15 text-rose-600"
                  }`}
                >
                  {vehicle.delayMinutes <= 1 ? "On time" : `+${vehicle.delayMinutes} min late`}
                </div>
              ) : (
                <div className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                  No delay data
                </div>
              )}
            </div>

            {/* Stop progress */}
            {vehicle.nearestStopName ? (
              <div className="mt-3 flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className="h-3 w-3 rounded-full border-2 border-[var(--brand)] bg-[var(--brand)]" />
                  {vehicle.nextStopName ? (
                    <>
                      <div className="h-6 w-0.5 bg-[var(--outline)]" />
                      <div className="h-3 w-3 rounded-full border-2 border-[var(--outline)] bg-[var(--surface)]" />
                    </>
                  ) : null}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      Near {vehicle.nearestStopName}
                    </div>
                    <div className="text-xs text-[var(--muted)]">Current location</div>
                  </div>
                  {vehicle.nextStopName ? (
                    <div>
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {vehicle.nextStopName}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Next stop
                        {vehicle.nextStopEta ? ` · ETA ${formatShortTime(vehicle.nextStopEta)}` : ""}
                        {vehicle.delayMinutes !== null && vehicle.delayMinutes > 1
                          ? ` (expect ~${vehicle.delayMinutes} min delay)`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--muted)]">Approaching final stop</div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Last update */}
            {vehicle.recordedAtTime ? (
              <div className="mt-2 text-xs text-[var(--muted)]">
                Position reported {formatShortTime(vehicle.recordedAtTime)}
              </div>
            ) : null}
          </div>
        ))
      )}

      {lastUpdated ? (
        <div className="text-xs text-[var(--muted)]">
          Last polled {formatShortTime(lastUpdated)} · updates every 15s
        </div>
      ) : null}
    </div>
  );
}
