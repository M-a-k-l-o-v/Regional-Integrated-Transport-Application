import Link from "next/link";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/PageHeader";
import PanelCard from "../../components/PanelCard";
import LegRouteMap from "./LegRouteMap";
import {
  JourneyLegDetailResponse,
  fetchJson,
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

  return (
    <AppShell activePath="journeys">
      <PageHeader
        eyebrow="Leg detail"
        title={detail ? `${detailTitle} from ${detail.leg.from.name} to ${detail.leg.to.name}` : detailTitle}
        description="This page breaks a single scheduled leg out of the journey planner and shows its mapped path plus any route-level operational datasets currently available in the database."
        backHref="/journeys"
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
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Departs</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{formatShortTime(detail.leg.departureTime)}</div>
                  </div>
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Arrives</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{formatShortTime(detail.leg.arrivalTime)}</div>
                  </div>
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Operator</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">{detail.leg.operator ?? "Unknown"}</div>
                  </div>
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Mapped points</div>
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
                <LegRouteMap points={detail.path.points} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                  <div>
                    The map uses the scheduled stop sequence for this leg. It is not a road-geometry trace.
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
                          <div className="text-lg font-semibold text-[var(--foreground)]">{point.name}</div>
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
                      <div className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{item.type}</div>
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
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Score</div>
                    <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">{detail.status.reliability.score?.toFixed(2)}</div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    Confidence {detail.status.reliability.confidenceLevel ?? "Unknown"} · calculated {formatTimestamp(detail.status.reliability.calculatedAt)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">{detail.status.reliability.message}</p>
              )
            ) : (
              <p className="text-sm text-[var(--muted)]">No leg selected.</p>
            )}
          </PanelCard>

          <PanelCard eyebrow="Delays" title="Delay state">
            {detail ? (
              detail.status.delays.available ? (
                <div className="space-y-3">
                  <div className="app-stat-tile">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Delay</div>
                    <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">{detail.status.delays.delayMinutes ?? 0} min</div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {detail.status.delays.cancellationFlag ? "Marked as cancelled" : "Not marked as cancelled"} · updated {formatTimestamp(detail.status.delays.lastUpdated)}
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
              <p className="text-sm text-[var(--muted)]">{detail.status.weather.message}</p>
            ) : (
              <p className="text-sm text-[var(--muted)]">No leg selected.</p>
            )}
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
