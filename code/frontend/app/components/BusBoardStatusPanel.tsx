"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BusLiveResponse,
  WeatherCurrentResponse,
  formatFreshnessLabel,
  formatTimestamp,
  getApiBaseUrl,
} from "../lib/transportApi";

type BusLiveSummary = {
  operatorCount: number;
  vehicleCount: number;
  monitoredVehicleCount: number;
  lastUpdated: string | null;
  matchedLines: string[];
} | null;

type BusBoardStatusPanelProps = {
  latitude: number | null;
  longitude: number | null;
  operatorIds: string[];
  lineLabels: string[];
  selectedServiceDate: string | null;
  scopeType: "bus_stop" | "bus_stop_group";
  dataStateLastUpdated: string | null;
  serviceDate: string | null;
  scheduledDepartureCount: number;
  initialWeather: WeatherCurrentResponse | null;
  initialLive: BusLiveSummary;
};

type PanelKey = "live" | "info";

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <path d="M3 12h4l2.2-4 3.4 8 2.2-4H21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function summariseLive(operatorIds: string[], lineLabels: string[], snapshots: Array<BusLiveResponse | null>): BusLiveSummary {
  if (operatorIds.length === 0) return null;

  const labels = new Set(lineLabels.map((value) => value.trim().toUpperCase()).filter(Boolean));
  const vehicles = snapshots
    .flatMap((snapshot) => snapshot?.vehicles ?? [])
    .filter((vehicle) => {
      const liveLine = (vehicle.publishedLineName ?? vehicle.lineRef ?? "").trim().toUpperCase();
      return liveLine.length > 0 && labels.has(liveLine);
    });

  const lastUpdated = [
    ...vehicles.map((vehicle) => vehicle.recordedAtTime).filter((value): value is string => Boolean(value)),
    ...snapshots.map((snapshot) => snapshot?.responseTimestamp).filter((value): value is string => Boolean(value)),
  ]
    .sort()
    .at(-1) ?? null;

  return {
    operatorCount: operatorIds.length,
    vehicleCount: vehicles.length,
    monitoredVehicleCount: vehicles.filter((vehicle) => vehicle.monitored === true).length,
    lastUpdated,
    matchedLines: Array.from(
      new Set(
        vehicles
          .map((vehicle) => (vehicle.publishedLineName ?? vehicle.lineRef ?? "").trim())
          .filter((value) => value.length > 0)
      )
    ).sort(),
  };
}

function panelButtonClass(active: boolean) {
  return active
    ? "border-[var(--brand)] bg-[var(--surface-accent)] text-[var(--brand-ink)]"
    : "border-[var(--outline)] bg-[var(--surface-soft)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand-ink)]";
}

function freshnessToneClass(tone: ReturnType<typeof formatFreshnessLabel>["tone"]) {
  if (tone === "fresh") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "aging") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "stale") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-[var(--outline)] bg-[var(--surface-soft)] text-[var(--muted)]";
}

export default function BusBoardStatusPanel({
  latitude,
  longitude,
  operatorIds,
  lineLabels,
  selectedServiceDate,
  scopeType,
  dataStateLastUpdated,
  serviceDate,
  scheduledDepartureCount,
  initialWeather,
  initialLive,
}: BusBoardStatusPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>("live");
  const [weather, setWeather] = useState<WeatherCurrentResponse | null>(initialWeather);
  const [live, setLive] = useState<BusLiveSummary>(initialLive);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if ((latitude === null || longitude === null) && operatorIds.length === 0) return;

    setIsRefreshing(true);
    try {
      const [weatherResponse, liveResponses] = await Promise.all([
        latitude !== null && longitude !== null
          ? fetch(`${getApiBaseUrl()}/weather/current?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`, { cache: "no-store" })
              .then((response) => (response.ok ? (response.json() as Promise<WeatherCurrentResponse>) : null))
              .catch(() => null)
          : Promise.resolve(null),
        operatorIds.length > 0
          ? Promise.all(
              operatorIds.slice(0, 4).map(async (operatorId) => {
                try {
                  const response = await fetch(`${getApiBaseUrl()}/bus/live/${encodeURIComponent(operatorId)}`, { cache: "no-store" });
                  return response.ok ? ((await response.json()) as BusLiveResponse) : null;
                } catch {
                  return null;
                }
              })
            )
          : Promise.resolve([]),
      ]);

      setWeather(weatherResponse);
      setLive(summariseLive(operatorIds, lineLabels, liveResponses));
      setClock(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, [latitude, longitude, operatorIds, lineLabels]);

  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 30000);
    const poll = window.setInterval(() => void refresh(), 60000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const liveFreshness = useMemo(
    () => formatFreshnessLabel(live?.lastUpdated ?? weather?.updatedAt ?? null, clock),
    [clock, live?.lastUpdated, weather?.updatedAt]
  );
  const scheduleFreshness = useMemo(() => formatFreshnessLabel(dataStateLastUpdated, clock), [clock, dataStateLastUpdated]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActivePanel("live")}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[var(--shadow-soft)] transition ${panelButtonClass(activePanel === "live")}`}
            aria-label="Open live status"
          >
            <PulseIcon />
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("info")}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[var(--shadow-soft)] transition ${panelButtonClass(activePanel === "info")}`}
            aria-label="Open board information"
          >
            <InfoIcon />
          </button>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${freshnessToneClass(activePanel === "live" ? liveFreshness.tone : scheduleFreshness.tone)}`}>
          {activePanel === "live" ? liveFreshness.label : scheduleFreshness.label}
        </div>
      </div>

      {activePanel === "live" ? (
        <div className="space-y-4 text-sm text-[var(--muted)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Live snapshot</div>
              <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">Current stop area state</div>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-ink)] transition hover:border-[var(--brand)]"
            >
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>

          {selectedServiceDate ? (
            <p>
              This panel reflects current activity around the {scopeType === "bus_stop_group" ? "hub" : "stop"}, not the selected scheduled service date <span className="font-semibold text-[var(--foreground)]">{selectedServiceDate}</span>.
            </p>
          ) : null}

          {live ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Live vehicles</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{live.vehicleCount}</div>
                </div>
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Monitored</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{live.monitoredVehicleCount}</div>
                </div>
              </div>
              <p>
                Latest operator snapshot {formatTimestamp(live.lastUpdated)} across {live.operatorCount} feed{live.operatorCount === 1 ? "" : "s"}.
              </p>
              {live.matchedLines.length > 0 ? (
                <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)]">
                  Active matched lines: {live.matchedLines.join(", ")}
                </div>
              ) : (
                <p>No current live vehicle reports matched the services on this scheduled board.</p>
              )}
            </>
          ) : (
            <p>Live bus operator data is not available for this stop right now.</p>
          )}

          {weather?.available ? (
            <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-[var(--foreground)]">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Current weather</div>
              <div className="mt-2 font-semibold">
                {weather.description ?? "Weather available"} · {weather.temperatureC !== null ? `${weather.temperatureC.toFixed(1)}°C` : "Unknown"}
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {weather.locationName ? `${weather.locationName} · ` : ""}
                updated {formatTimestamp(weather.updatedAt)}
              </div>
            </div>
          ) : (
            <p>Current weather is unavailable for this stop area.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-sm text-[var(--muted)]">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Board information</div>
            <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">Scheduled fallback</div>
          </div>
          <p>Last scheduled board update {formatTimestamp(dataStateLastUpdated)}.</p>
          <p>
            This service list remains scheduled-only. Live weather and operator snapshots are informational and do not change the expected timetable for {serviceDate ?? "the selected date"}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-stat-tile">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Service date</div>
              <div className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{serviceDate ?? "Unknown"}</div>
            </div>
            <div className="app-stat-tile">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Scheduled calls</div>
              <div className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{scheduledDepartureCount}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
