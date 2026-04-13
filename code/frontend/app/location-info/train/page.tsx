import AppShell from "../../components/AppShell";
import BoardAutoRefresh from "../../components/BoardAutoRefresh";
import BoardVisitTracker from "../../components/BoardVisitTracker";
import PageHeader from "../../components/PageHeader";
import PanelCard from "../../components/PanelCard";
import RailDepartureList from "../../components/RailDepartureList";
import StationFacilitiesPanel from "../../components/StationFacilitiesPanel";
import TrainBoardStatusPanel from "../../components/TrainBoardStatusPanel";
import TrainBoardControls from "../../components/TrainBoardControls";
import {
  DEFAULT_TRAIN_FROM,
  PlannerLocation,
  RailDeparturesResponse,
  RailLiveDeparturesResponse,
  StationFacilitiesResponse,
  WeatherCurrentResponse,
  fetchJson,
  getLondonTodayDate,
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

type TrainOperationalSnapshot = {
  weather: WeatherCurrentResponse | null;
  liveBoard: RailLiveDeparturesResponse | null;
};

async function loadTrainOperationalSnapshot(result: RailDeparturesResponse | null): Promise<TrainOperationalSnapshot> {
  if (!result) {
    return { weather: null, liveBoard: null };
  }

  const [weatherResult, liveBoardResult] = await Promise.all([
    result.station.latitude !== null && result.station.longitude !== null
      ? fetchJson<WeatherCurrentResponse>(
          `/weather/current?lat=${encodeURIComponent(String(result.station.latitude))}&lon=${encodeURIComponent(String(result.station.longitude))}`
        )
      : Promise.resolve({ data: null, error: null }),
    fetchJson<RailLiveDeparturesResponse>(`/rail/live/departures/${encodeURIComponent(result.station.stationId)}`),
  ]);

  return {
    weather: weatherResult.data,
    liveBoard: liveBoardResult.data,
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
  const [operationalSnapshot, facilitiesResult] = await Promise.all([
    loadTrainOperationalSnapshot(result.data),
    crs.length === 3
      ? fetchJson<StationFacilitiesResponse>(`/rail/stations/${encodeURIComponent(crs)}/facilities`)
      : Promise.resolve({ data: null, error: null }),
  ]);
  const facilities = facilitiesResult.data?.facilities ?? null;
  const selectedServiceDate = result.data?.window.serviceDate ?? null;
  const liveSnapshotDate = operationalSnapshot.liveBoard?.generatedAt?.slice(0, 10) ?? null;
  const selectedDateIsToday = selectedServiceDate !== null && selectedServiceDate === getLondonTodayDate();

  return (
    <AppShell activePath="boards">
      <PageHeader
        eyebrow="Rail board"
        title={result.data?.station.name ?? "Train departures"}
        description="Scheduled rail departures for the selected time window."
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
          {crs.length === 3 ? <BoardAutoRefresh intervalSeconds={90} /> : null}

          {result.error ? (
            <PanelCard eyebrow="Rail error" title="Unable to load the rail board">
              <p className="text-sm text-rose-700">{result.error}</p>
            </PanelCard>
          ) : null}

          {result.data ? (
            <RailDepartureList departures={result.data.departures} initialVisible={3} />
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

          <PanelCard eyebrow="More details" title="Live context and board information">
            <TrainBoardStatusPanel
              crs={crs}
              stationName={result.data?.station.name ?? null}
              latitude={result.data?.station.latitude ?? null}
              longitude={result.data?.station.longitude ?? null}
              selectedServiceDate={selectedServiceDate}
              liveSnapshotDate={liveSnapshotDate}
              dataStateLastUpdated={result.data?.dataState.lastUpdated ?? null}
              windowFrom={result.data?.window.from ?? null}
              windowTo={result.data?.window.to ?? null}
              departureCount={result.data?.count ?? 0}
              initialWeather={operationalSnapshot.weather}
              initialLiveBoard={operationalSnapshot.liveBoard}
            />
          </PanelCard>

          {facilities ? (
            <PanelCard
              eyebrow="Station facilities"
              title={`${facilities.name} facilities`}
              description={facilities.staffed ? "Staffed station" : "Unstaffed station"}
            >
              <StationFacilitiesPanel facilities={facilities} />
            </PanelCard>
          ) : crs.length === 3 ? (
            <PanelCard eyebrow="Station facilities" title="Facilities unavailable">
              <p className="text-sm text-[var(--muted)]">Facility information is not yet available for this station.</p>
            </PanelCard>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
