import AppShell from "../../components/AppShell";
import BoardVisitTracker from "../../components/BoardVisitTracker";
import PageHeader from "../../components/PageHeader";
import PanelCard from "../../components/PanelCard";
import TrainBoardControls from "../../components/TrainBoardControls";
import {
  DEFAULT_TRAIN_FROM,
  PlannerLocation,
  RailDeparturesResponse,
  fetchJson,
  formatShortTime,
  formatTimestamp,
} from "../../lib/transportApi";

export const dynamic = "force-dynamic";

type TrainPageProps = {
  searchParams?: Promise<{
    crs?: string;
    from?: string;
    q?: string;
    stationName?: string;
  }>;
};

function getInitialStation(
  params: Awaited<TrainPageProps["searchParams"]>,
  result: RailDeparturesResponse | null
): PlannerLocation | null {
  if (result) {
    return {
      type: "station",
      id: result.station.stationId,
      code: result.station.stationId,
      name: result.station.name,
      localityName: null,
    };
  }

  const crs = typeof params?.crs === "string" ? params.crs.trim().toUpperCase() : "";
  const stationName = typeof params?.stationName === "string" ? params.stationName.trim() : "";
  if (crs.length !== 3) return null;

  return {
    type: "station",
    id: crs,
    code: crs,
    name: stationName || crs,
    localityName: null,
  };
}

export default async function TrainLocationPage({ searchParams }: TrainPageProps) {
  const params = (await searchParams) ?? {};
  const crs = typeof params.crs === "string" ? params.crs.trim().toUpperCase() : "";
  const from = typeof params.from === "string" && params.from.trim().length > 0 ? params.from : DEFAULT_TRAIN_FROM;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const result =
    crs.length === 3
      ? await fetchJson<RailDeparturesResponse>(
          `/rail/departures/${encodeURIComponent(crs)}?from=${encodeURIComponent(from)}&windowMinutes=240&limit=20`
        )
      : { data: null, error: null };

  return (
    <AppShell activePath="boards">
      <PageHeader
        eyebrow="Rail board"
        title={result.data?.station.name ?? "Train departures"}
        description="Passenger-facing scheduled rail departures. Operational-only locations are filtered out and STP overlay precedence is applied before the board is rendered."
        backHref="/boards"
        backLabel="Back"
      />

      {result.data ? (
        <BoardVisitTracker
          mode="rail"
          location={{
            type: "station",
            id: result.data.station.stationId,
            code: result.data.station.stationId,
            name: result.data.station.name,
            localityName: null,
          }}
          href={`/location-info/train?crs=${encodeURIComponent(result.data.station.stationId)}&from=${encodeURIComponent(from)}`}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-4">
          {result.error ? (
            <PanelCard eyebrow="Rail error" title="Unable to load the rail board">
              <p className="text-sm text-rose-700">{result.error}</p>
            </PanelCard>
          ) : null}

          {result.data ? (
            result.data.departures.length === 0 ? (
              <PanelCard eyebrow="No departures" title="Nothing matched this time window">
                <p className="text-sm text-[var(--muted)]">No departures were returned for the requested station and time window.</p>
              </PanelCard>
            ) : (
              result.data.departures.map((departure) => (
                <PanelCard
                  key={`${departure.scheduleId}:${departure.stopId}`}
                  eyebrow="Rail leg"
                  title={departure.destination ?? "Destination unavailable"}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="app-stat-tile min-w-[118px]">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Departs</div>
                        <div className="mt-1 text-3xl font-semibold text-[var(--brand-ink)]">
                          {departure.scheduledDeparture ?? departure.scheduledDepartureRaw ?? "Unknown"}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-lg font-semibold text-[var(--foreground)]">{departure.destination ?? "Destination unavailable"}</div>
                        <div className="text-sm text-[var(--muted)]">
                          {departure.platform ? `Platform ${departure.platform}` : "Platform TBC"}
                          {departure.operatorCode ? ` · ${departure.operatorCode}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-[var(--shadow-soft)]">
                      Scheduled
                    </div>
                  </div>
                </PanelCard>
              ))
            )
          ) : (
            <PanelCard eyebrow="Rail board" title="Search for a station">
              <p className="text-sm text-[var(--muted)]">Use the station search to load a passenger-facing scheduled rail board.</p>
            </PanelCard>
          )}
        </div>

        <div className="space-y-6">
          <PanelCard eyebrow="Controls" title="Load another station">
            <TrainBoardControls
              initialStation={getInitialStation(params, result.data)}
              initialFrom={from}
              query={query}
            />
          </PanelCard>

          <PanelCard eyebrow="Data state" title="Scheduled fallback">
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p>Last updated {formatTimestamp(result.data?.dataState.lastUpdated ?? null)}.</p>
              <p>Live rail enrichment is not implemented yet, so this board is sourced from the timetable snapshot.</p>
              {result.data ? (
                <p>
                  Window {formatShortTime(result.data.window.from)} to {formatShortTime(result.data.window.to)} · {result.data.count} departures returned.
                </p>
              ) : null}
            </div>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
