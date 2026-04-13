"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RailLiveDeparturesResponse,
  WeatherCurrentResponse,
  formatFreshnessLabel,
  formatShortTime,
  formatTimestamp,
  getApiBaseUrl,
} from "../lib/transportApi";

type TrainBoardStatusPanelProps = {
  crs: string;
  stationName: string | null;
  latitude: number | null;
  longitude: number | null;
  selectedServiceDate: string | null;
  liveSnapshotDate: string | null;
  dataStateLastUpdated: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  departureCount: number;
  initialWeather: WeatherCurrentResponse | null;
  initialLiveBoard: RailLiveDeparturesResponse | null;
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

export default function TrainBoardStatusPanel({
  crs,
  stationName,
  latitude,
  longitude,
  selectedServiceDate,
  liveSnapshotDate,
  dataStateLastUpdated,
  windowFrom,
  windowTo,
  departureCount,
  initialWeather,
  initialLiveBoard,
}: TrainBoardStatusPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>("live");
  const [weather, setWeather] = useState<WeatherCurrentResponse | null>(initialWeather);
  const [liveBoard, setLiveBoard] = useState<RailLiveDeparturesResponse | null>(initialLiveBoard);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if (!crs) return;
    setIsRefreshing(true);
    try {
      const [liveBoardResponse, weatherResponse] = await Promise.all([
        fetch(`${getApiBaseUrl()}/rail/live/departures/${encodeURIComponent(crs)}`, { cache: "no-store" })
          .then((response) => (response.ok ? (response.json() as Promise<RailLiveDeparturesResponse>) : null))
          .catch(() => null),
        latitude !== null && longitude !== null
          ? fetch(`${getApiBaseUrl()}/weather/current?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`, { cache: "no-store" })
              .then((response) => (response.ok ? (response.json() as Promise<WeatherCurrentResponse>) : null))
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      setLiveBoard(liveBoardResponse);
      setWeather(weatherResponse);
      setClock(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, [crs, latitude, longitude]);

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
    () => formatFreshnessLabel(liveBoard?.generatedAt ?? weather?.updatedAt ?? null, clock),
    [clock, liveBoard?.generatedAt, weather?.updatedAt]
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
              <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">Current station state</div>
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
              This panel reflects the station’s current live state, not the selected scheduled service date <span className="font-semibold text-[var(--foreground)]">{selectedServiceDate}</span>.
            </p>
          ) : null}

          {liveBoard ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Live trains</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{liveBoard.trainServices.length}</div>
                </div>
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Replacement buses</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{liveBoard.busServices.length}</div>
                </div>
              </div>
              <p>
                Generated {formatTimestamp(liveBoard.generatedAt)} for <span className="font-semibold text-[var(--foreground)]">{liveBoard.locationName ?? stationName ?? crs}</span>
                {liveSnapshotDate ? ` · live snapshot date ${liveSnapshotDate}` : ""}
              </p>
              {liveBoard.nrccMessages.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em]">Live notices</div>
                  <div className="mt-2">{liveBoard.nrccMessages.length} NRCC notice(s) currently published for this station.</div>
                </div>
              ) : (
                <p>No NRCC notices are currently published for this station board.</p>
              )}
            </>
          ) : (
            <p>Live rail board data is not available for this station right now.</p>
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
            <p>Current weather is unavailable for this station area.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-sm text-[var(--muted)]">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Board information</div>
            <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">Scheduled fallback</div>
          </div>
          <p>Last scheduled board update {formatTimestamp(dataStateLastUpdated)}.</p>
          <p>This departure list remains scheduled-only. The live station snapshot is informational and does not change the board ordering yet.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-stat-tile">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Window</div>
              <div className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{formatShortTime(windowFrom)} to {formatShortTime(windowTo)}</div>
            </div>
            <div className="app-stat-tile">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Scheduled departures</div>
              <div className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">{departureCount}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
