import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/PageHeader";
import PanelCard from "../../components/PanelCard";
import { routeGeometryService } from "../RouteGeometryService";
import LegRouteMap from "./LegRouteMap";
import StopAmenitiesButton from "./StopAmenitiesButton";
import {
  JourneyLegDetailResponse,
  fetchJson,
  formatDurationMinutes,
  formatShortTime,
  formatTimestamp,
} from "../../lib/transportApi";

export const dynamic = "force-dynamic";

type JourneyLegPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

function labelFromSearchParams(params: Record<string, string | undefined>) {
  const mode = params.mode === "rail" ? "rail" : "bus";
  const line = params.line?.trim();
  if (line) return mode === "bus" ? `Service ${line}` : `Train ${line}`;
  return mode === "bus" ? "Bus route" : "Rail route";
}

function buildDetailPath(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  if (params.mode) query.set("mode", params.mode);
  if (params.scheduleId) query.set("scheduleId", params.scheduleId);
  if (params.fromId) query.set("fromId", params.fromId);
  if (params.toId) query.set("toId", params.toId);
  return query.toString().length > 0 ? `/journeys/legs/detail?${query.toString()}` : null;
}

function getLegDurationMinutes(departureTime: string | null, arrivalTime: string | null): number | null {
  if (!departureTime || !arrivalTime) return null;
  const departureMs = new Date(departureTime).getTime();
  const arrivalMs = new Date(arrivalTime).getTime();
  if (!Number.isFinite(departureMs) || !Number.isFinite(arrivalMs) || arrivalMs < departureMs) return null;
  return Math.max(1, Math.round((arrivalMs - departureMs) / 60000));
}

export default async function JourneyLegPage({ searchParams }: JourneyLegPageProps) {
  const params = (await searchParams) ?? {};
  const detailPath = buildDetailPath(params);
  const result = detailPath ? await fetchJson<JourneyLegDetailResponse>(detailPath) : { data: null, error: null };

  const detail = result.data;
  const detailTitle =
    detail?.leg.line
      ? detail.leg.mode === "bus"
        ? `Service ${detail.leg.line}`
        : `Train ${detail.leg.line}`
      : labelFromSearchParams(params);
  const originalMapPoints = detail
    ? detail.path.points.filter(
        (point): point is typeof point & { latitude: number; longitude: number } =>
          point.latitude !== null && point.longitude !== null
      )
    : [];
  const refinedGeometryPoints = detail
    ? await routeGeometryService.refinePath(
        detail.leg.mode,
        originalMapPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))
      )
    : [];
  const durationMinutes = detail ? getLegDurationMinutes(detail.leg.departureTime, detail.leg.arrivalTime) : null;
  const durationLabel = durationMinutes ? formatDurationMinutes(durationMinutes) : "Scheduled leg";

  return (
    <AppShell activePath="journeys">
      <PageHeader
        eyebrow="Leg detail"
        title={detail ? `${detailTitle} from ${detail.leg.from.name} to ${detail.leg.to.name}` : detailTitle}
        description="Mapped path and operational detail for this leg."
        backHref={params.returnTo && params.returnTo.startsWith("/journeys") ? params.returnTo : "/journeys"}
        backLabel="Back to itineraries"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
        <div className="space-y-6">
          {result.error ? (
            <PanelCard eyebrow="Detail error" title="Unable to load the route detail">
              <p className="text-sm text-rose-700">{result.error}</p>
            </PanelCard>
          ) : null}

          {detail ? (
            <>
              <PanelCard eyebrow={detail.leg.mode === "bus" ? "Bus service" : "Rail service"} title={detailTitle}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departs</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{formatShortTime(detail.leg.departureTime)}</div>
                  </div>
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Arrives</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{formatShortTime(detail.leg.arrivalTime)}</div>
                  </div>
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Operator</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">{detail.leg.operator ?? "Unknown"}</div>
                  </div>
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Mapped points</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                      {detail.path.mappedPointCount}/{detail.path.pointCount}
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-sm text-[var(--muted)]">
                  {detail.leg.from.name} to {detail.leg.to.name}
                  {detail.leg.destinationDisplay ? ` · toward ${detail.leg.destinationDisplay}` : ""}
                </div>
              </PanelCard>

              <PanelCard eyebrow="Route map" title="Mapped path">
                <LegRouteMap
                  points={detail.path.points}
                  geometryPoints={refinedGeometryPoints}
                  mode={detail.leg.mode}
                  routeTitle={detailTitle}
                  durationLabel={durationLabel}
                  operator={detail.leg.operator}
                  mappedPointCount={detail.path.mappedPointCount}
                  totalPointCount={detail.path.pointCount}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                  <div>
                    Bus legs use road-snapped corridor geometry where available. Rail legs still use the scheduled stop sequence.
                  </div>
                  <Link
                    href={`/map?q=${encodeURIComponent(detail.leg.from.name)}&mode=${detail.leg.mode === "rail" ? "rail" : "bus"}`}
                    className="inline-flex items-center rounded-full bg-[var(--surface-accent)] px-4 py-2 font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
                  >
                    Open area map
                  </Link>
                </div>
              </PanelCard>

              <PanelCard eyebrow="Stop sequence" title="Scheduled calling pattern">
                <div className="space-y-3">
                  {detail.path.points.map((point, index) => (
                    <div key={`${point.id}-${index}`} className="app-list-card">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold text-[var(--foreground)]">{point.name}</div>
                            {detail.leg.mode === "rail" ? (
                              <StopAmenitiesButton
                                stopName={point.name}
                                stopCode={point.code}
                                stopType={point.type}
                              />
                            ) : null}
                          </div>
                          <div className="text-sm text-[var(--muted)]">
                            {[point.localityName, point.code].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-[var(--brand-ink)]">
                          {formatShortTime(point.departureTime ?? point.arrivalTime)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </>
          ) : (
            <PanelCard eyebrow="Leg detail" title="Pick a journey leg first">
              <p className="text-sm text-[var(--muted)]">Open this page from a bus or rail itinerary leg.</p>
            </PanelCard>
          )}
        </div>

        <div className="space-y-6">
          <PanelCard eyebrow="Disruptions" title="Route disruptions">
            {detail ? (
              detail.status.disruptions.available ? (
                <div className="space-y-3">
                  {detail.status.disruptions.items.map((item, index) => (
                    <div key={`${item.type}-${index}`} className="app-list-card">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                        <span>{item.type}</span>
                        {item.source ? (
                          <span className="rounded-full bg-[var(--surface-accent)] px-2 py-1 text-[10px] font-semibold text-[var(--brand)]">
                            {item.source.replaceAll("_", " ")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-base font-semibold text-[var(--foreground)]">{item.description}</div>
                      <div className="mt-2 text-sm text-[var(--muted)]">
                        {formatTimestamp(item.startTime)} to {formatTimestamp(item.endTime)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">{detail.status.disruptions.message}</p>
              )
            ) : (
              <p className="text-sm text-[var(--muted)]">No leg selected.</p>
            )}
          </PanelCard>

          <PanelCard eyebrow="Reliability" title="Route reliability index">
            {detail ? (
              detail.status.reliability.available ? (
                <div className="space-y-3">
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Score</div>
                    <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">{detail.status.reliability.score?.toFixed(2)}</div>
                  </div>
                  <div 
                    className="text-sm text-[var(--muted)] flex items-center gap-1.5 cursor-help"
                    title="Experimental in-house AI model. Accuracy is not guaranteed."
                  >
                    Confidence {detail.status.reliability.confidenceLevel ?? "Unknown"} · calculated {formatTimestamp(detail.status.reliability.calculatedAt)}
                    <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">{detail.status.reliability.message}</p>
              )
            ) : (
              <p className="text-sm text-[var(--muted)]">No leg selected.</p>
            )}
          </PanelCard>

          <PanelCard eyebrow="Delays" title={`Delay state${detail?.dataState.isLive ? " · Live" : ""}`}>
            {detail ? (
              detail.status.delays.available ? (
                <div className="space-y-3">
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Delay</div>
                    <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">{detail.status.delays.delayMinutes ?? 0} min</div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {detail.status.delays.cancellationFlag ? "Marked as cancelled" : "Not marked as cancelled"} · updated {formatTimestamp(detail.status.delays.lastUpdated)}
                  </div>
                  {detail.status.delays.summary ? (
                    <div className="rounded-3xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                      {detail.status.delays.summary}
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Source</div>
                      <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
                        {detail.status.delays.source ? detail.status.delays.source.replaceAll("_", " ") : "Unknown"}
                      </div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Expected</div>
                      <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
                        {detail.status.delays.expectedDepartureTime ?? detail.status.delays.liveDepartureTime ?? "Unknown"}
                      </div>
                    </div>
                    {detail.status.delays.platform ? (
                      <div className="app-stat-tile">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Platform</div>
                        <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">{detail.status.delays.platform}</div>
                      </div>
                    ) : null}
                    {detail.status.delays.lineVehicleCount !== null ? (
                      <div className="app-stat-tile">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Live vehicles</div>
                        <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
                          {detail.status.delays.monitoredVehicleCount ?? 0}/{detail.status.delays.lineVehicleCount}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">{detail.status.delays.message}</p>
              )
            ) : (
              <p className="text-sm text-[var(--muted)]">No leg selected.</p>
            )}
          </PanelCard>

          <PanelCard eyebrow="Weather" title="Area weather impact">
            {detail ? (
              detail.status.weather.available ? (
                <div className="space-y-3">
                  <div className="rounded-3xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                    {detail.status.weather.message}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Temperature</div>
                      <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">
                        {detail.status.weather.temperatureC !== null ? `${detail.status.weather.temperatureC.toFixed(1)}°C` : "Unknown"}
                      </div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Feels like</div>
                      <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">
                        {detail.status.weather.feelsLikeC !== null ? `${detail.status.weather.feelsLikeC.toFixed(1)}°C` : "Unknown"}
                      </div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Humidity</div>
                      <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
                        {detail.status.weather.humidity !== null ? `${detail.status.weather.humidity}%` : "Unknown"}
                      </div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Wind</div>
                      <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
                        {detail.status.weather.windSpeedMps !== null ? `${detail.status.weather.windSpeedMps.toFixed(1)} m/s` : "Unknown"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {detail.status.weather.locationName ? `Nearest weather point: ${detail.status.weather.locationName} · ` : ""}
                    updated {formatTimestamp(detail.status.weather.updatedAt)}
                    {detail.status.weather.icon ? ` · icon ${detail.status.weather.icon}` : ""}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">{detail.status.weather.message}</p>
              )
            ) : (
              <p className="text-sm text-[var(--muted)]">No leg selected.</p>
            )}
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
