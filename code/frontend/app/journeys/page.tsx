import AppShell from "../components/AppShell";
import JourneyPlannerForm from "../components/JourneyPlannerForm";
import PageHeader from "../components/PageHeader";
import PanelCard from "../components/PanelCard";
import JourneyResultsExplorer from "./JourneyResultsExplorer";
import RecentJourneyStrip from "./RecentJourneyStrip";
import SaveRecentJourney from "./SaveRecentJourney";
import { routeGeometryService } from "./RouteGeometryService";
import { JourneyRouteShape } from "./types";
import {
  JourneyLegDetailResponse,
  JourneyPlanResponse,
  JourneyPreference,
  PlannerLocation,
  TransitModeFilter,
  buildJourneyLegDetailPath,
  fetchJson,
  getLondonCurrentPlannerDefaults,
  postJson,
} from "../lib/transportApi";

export const dynamic = "force-dynamic";

type JourneysPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

function parseLocation(params: Record<string, string | undefined>, prefix: "origin" | "destination"): PlannerLocation | null {
  const type = params[`${prefix}Type`];
  const id = params[`${prefix}Id`];
  const name = params[`${prefix}Name`];
  const code = params[`${prefix}Code`];
  const localityName = params[`${prefix}LocalityName`];
  if ((type !== "station" && type !== "bus_stop" && type !== "bus_stop_group") || !id || !name || !code) {
    return null;
  }
  return { type, id, name, code, localityName: localityName ?? null };
}

function formatLocationHeading(location: PlannerLocation | null): string {
  if (!location) return "";
  return location.localityName ? `${location.name} (${location.localityName})` : location.name;
}

function parsePreference(value: string | undefined): JourneyPreference {
  if (value === "balanced" || value === "fewest_changes") return value;
  return "fastest";
}

function parseModes(raw: string | string[] | undefined): TransitModeFilter[] | undefined {
  if (!raw) return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const valid = values.filter((v): v is TransitModeFilter => v === "bus" || v === "rail");
  return valid.length > 0 ? valid : undefined;
}

function buildJourneyHref(origin: PlannerLocation, destination: PlannerLocation, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  sp.set("originType", origin.type);
  sp.set("originId", origin.id);
  sp.set("originName", origin.name);
  sp.set("originCode", origin.code);
  if (origin.localityName) sp.set("originLocalityName", origin.localityName);
  sp.set("destinationType", destination.type);
  sp.set("destinationId", destination.id);
  sp.set("destinationName", destination.name);
  sp.set("destinationCode", destination.code);
  if (destination.localityName) sp.set("destinationLocalityName", destination.localityName);
  if (params.preference) sp.set("preference", params.preference);
  if (params.date) sp.set("date", params.date);
  if (params.time) sp.set("time", params.time);
  if (params.modes) sp.set("modes", params.modes);
  return `/journeys?${sp.toString()}`;
}

function getLegKey(leg: JourneyPlanResponse["itineraries"][number]["legs"][number]): string | null {
  if (leg.mode === "walk" || !leg.scheduleId) return null;
  return `${leg.mode}:${leg.scheduleId}:${leg.from.id}:${leg.to.id}`;
}

function hasCoordinates(location: PlannerLocation): location is PlannerLocation & { latitude: number; longitude: number } {
  return typeof location.latitude === "number" && typeof location.longitude === "number";
}

async function loadLegDetails(itineraries: JourneyPlanResponse["itineraries"]): Promise<Map<string, JourneyLegDetailResponse>> {
  const uniqueRequests = new Map<string, string>();

  for (const itinerary of itineraries) {
    for (const leg of itinerary.legs) {
      const key = getLegKey(leg);
      const path = buildJourneyLegDetailPath(leg);
      if (!key || !path || uniqueRequests.has(key)) continue;
      uniqueRequests.set(key, path);
    }
  }

  const resolved = await Promise.all(
    Array.from(uniqueRequests.entries()).map(async ([key, path]) => {
      const result = await fetchJson<JourneyLegDetailResponse>(path);
      return [key, result.data] as const;
    })
  );

  return new Map(resolved.filter((entry): entry is readonly [string, JourneyLegDetailResponse] => entry[1] !== null));
}

async function buildRouteShapes(
  itineraries: JourneyPlanResponse["itineraries"],
  legDetails: Map<string, JourneyLegDetailResponse>
): Promise<JourneyRouteShape[]> {
  const routeShapes = itineraries.map((itinerary) => {
    const segments = itinerary.legs.flatMap((leg) => {
      if (leg.mode === "walk" && hasCoordinates(leg.from) && hasCoordinates(leg.to)) {
        return [{
          mode: "walk" as const,
          points: [
            { latitude: leg.from.latitude, longitude: leg.from.longitude },
            { latitude: leg.to.latitude, longitude: leg.to.longitude },
          ],
        }];
      }

      const key = getLegKey(leg);
      const detail = key ? legDetails.get(key) : null;
      if (detail) {
        const points = detail.path.points
          .filter((point): point is typeof point & { latitude: number; longitude: number } => point.latitude !== null && point.longitude !== null)
          .map((point) => ({ latitude: point.latitude, longitude: point.longitude }));

        if (points.length >= 2) {
          return [{ mode: leg.mode, points }];
        }
      }

      if (hasCoordinates(leg.from) && hasCoordinates(leg.to)) {
        return [{
          mode: leg.mode,
          points: [
            { latitude: leg.from.latitude, longitude: leg.from.longitude },
            { latitude: leg.to.latitude, longitude: leg.to.longitude },
          ],
        }];
      }

      return [];
    });

    return {
      segments,
      hasMappedPath: segments.some((segment) => segment.points.length >= 2),
    };
  });

  return routeGeometryService.refineShapes(routeShapes);
}

export default async function JourneysPage({ searchParams }: JourneysPageProps) {
  const params = (await searchParams) ?? {};
  const plannerDefaults = getLondonCurrentPlannerDefaults();
  const origin = parseLocation(params, "origin");
  const destination = parseLocation(params, "destination");
  const preference = parsePreference(params.preference);
  const date = params.date ?? plannerDefaults.date;
  const time = params.time ?? plannerDefaults.time;
  const modes = parseModes(params.modes);

  const result =
    origin && destination
      ? await postJson<JourneyPlanResponse>("/journeys/plan", {
        origin: { type: origin.type, id: origin.id },
        destination: { type: destination.type, id: destination.id },
        date,
        time,
        preference,
        maxItineraries: 8,
        ...(modes ? { modes } : {}),
      })
      : { data: null, error: null };

  const legDetailsMap = result.data ? await loadLegDetails(result.data.itineraries) : new Map();
  const routeShapes = result.data ? await buildRouteShapes(result.data.itineraries, legDetailsMap) : [];
  const legDetailsRecord: Record<string, JourneyLegDetailResponse> = {};
  for (const [key, value] of legDetailsMap) {
    legDetailsRecord[key] = value;
  }

  return (
    <AppShell activePath="journeys">
      <PageHeader
        eyebrow="Journey results"
        title={origin && destination ? `${formatLocationHeading(origin)} to ${formatLocationHeading(destination)}` : "Scheduled planner results"}
        description="Compare routes on the map and pick the best option."
        backHref="/home"
        backLabel="Back to planner"
      />

      <div className="space-y-6">
        {result.error ? (
          <PanelCard eyebrow="Planner error" title="The journey request failed">
            <p className="text-sm text-rose-700">{result.error}</p>
          </PanelCard>
        ) : null}

        {!origin || !destination ? (
          <PanelCard eyebrow="Recent journeys" title="Pick up where you left off">
            <RecentJourneyStrip />
          </PanelCard>
        ) : null}

        {result.data && result.data.itineraries.length === 0 ? (
          <PanelCard eyebrow="No route" title="No scheduled journey was found">
            <p className="text-sm text-[var(--muted)]">
              Try a different time, use a broader interchange point, or change the preference from fewest changes to fastest.
            </p>
          </PanelCard>
        ) : null}

        {result.data && result.data.itineraries.length > 0 && origin && destination ? (
          <>
            <SaveRecentJourney
              originName={origin.name}
              originLocalityName={origin.localityName ?? null}
              destinationName={destination.name}
              destinationLocalityName={destination.localityName ?? null}
              href={buildJourneyHref(origin, destination, params)}
            />
            <JourneyResultsExplorer
              itineraries={result.data.itineraries}
              routeShapes={routeShapes}
              preference={preference}
              legDetails={legDetailsRecord}
            />
          </>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
          <PanelCard eyebrow="Adjust search" title="Re-plan this journey">
            <JourneyPlannerForm
              initialOrigin={origin}
              initialDestination={destination}
              initialDate={date}
              initialTime={time}
              initialPreference={preference}
              initialModes={modes}
            />
          </PanelCard>

          <PanelCard eyebrow="About" title="How routes are planned">
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>Bus routes use scheduled timetable data.</li>
              <li>Rail routes use passenger-facing departures.</li>
              <li>Walking transfers connect nearby stops.</li>
            </ul>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
