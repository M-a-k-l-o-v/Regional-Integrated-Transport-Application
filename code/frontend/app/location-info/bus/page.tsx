import AppShell from "../../components/AppShell";
import BoardAutoRefresh from "../../components/BoardAutoRefresh";
import BoardVisitTracker from "../../components/BoardVisitTracker";
import BusBoardControls from "../../components/BusBoardControls";
import BusBoardStatusPanel from "../../components/BusBoardStatusPanel";
import PageHeader from "../../components/PageHeader";
import PanelCard from "../../components/PanelCard";
import {
  BusDeparturesResponse,
  BusLiveResponse,
  BusRouteCalendarResponse,
  DEFAULT_BUS_DATE,
  PlannerLocation,
  WeatherCurrentResponse,
  fetchJson,
  formatShortDate,
  formatShortTime,
  formatTimestamp,
  getLondonTodayDate,
  getRouteCode,
} from "../../lib/transportApi";

export const dynamic = "force-dynamic";

type BusPageProps = {
  searchParams?: Promise<{
    stopId?: string;
    groupId?: string;
    date?: string;
    q?: string;
    selectedType?: string;
    groupName?: string;
    stopName?: string;
    stopCode?: string;
    stopLocalityName?: string;
  }>;
};

type ServiceSummary = {
  key: string;
  routeId: string;
  lineRef: string;
  direction: string | null;
  destinationDisplay: string | null;
  operatorName: string;
  departures: BusDeparturesResponse["departures"];
  calendarData: BusRouteCalendarResponse | null;
  calendarError: string | null;
};

type BusOperationalSnapshot = {
  weather: WeatherCurrentResponse | null;
  live: {
    operatorCount: number;
    vehicleCount: number;
    monitoredVehicleCount: number;
    lastUpdated: string | null;
    matchedLines: string[];
  } | null;
};

function getBusBadge(calendarData: BusRouteCalendarResponse | null) {
  if (!calendarData) {
    return { label: "Scheduled only", className: "bg-amber-100 text-amber-900" };
  }

  if (!calendarData.runsOnDate) {
    return { label: "Calendar mismatch", className: "bg-rose-100 text-rose-900" };
  }

  return { label: "Scheduled only", className: "bg-amber-100 text-amber-900" };
}

function getInitialStop(
  params: Awaited<BusPageProps["searchParams"]>,
  result: BusDeparturesResponse | null
): PlannerLocation | null {
  if (result) {
    return {
      type: result.scope.type,
      id: result.scope.id,
      code: result.scope.code,
      name: result.scope.name,
      localityName: result.scope.localityName,
    };
  }

  const stopId = typeof params?.stopId === "string" ? params.stopId.trim() : "";
  const groupId = typeof params?.groupId === "string" ? params.groupId.trim() : "";
  const selectedType = typeof params?.selectedType === "string" ? params.selectedType.trim() : "";
  const groupName = typeof params?.groupName === "string" ? params.groupName.trim() : "";
  const stopName = typeof params?.stopName === "string" ? params.stopName.trim() : "";
  const stopCode = typeof params?.stopCode === "string" ? params.stopCode.trim() : stopId || groupId;
  const stopLocalityName =
    typeof params?.stopLocalityName === "string" && params.stopLocalityName.trim().length > 0
      ? params.stopLocalityName.trim()
      : null;

  if ((selectedType === "bus_stop_group" || groupId) && groupId && groupName) {
    return {
      type: "bus_stop_group",
      id: groupId,
      code: stopCode || groupId,
      name: groupName,
      localityName: stopLocalityName,
    };
  }

  if (!stopId || !stopName) return null;

  return {
    type: "bus_stop",
    id: stopId,
    code: stopCode || stopId,
    name: stopName,
    localityName: stopLocalityName,
  };
}

async function loadBusOperationalSnapshot(
  result: BusDeparturesResponse | null,
  serviceSummaries: ServiceSummary[]
): Promise<BusOperationalSnapshot> {
  if (!result) {
    return { weather: null, live: null };
  }

  const liveOperators = Array.from(
    new Set(result.departures.map((departure) => departure.operator?.operatorId).filter((value): value is string => Boolean(value)))
  );
  const serviceLabels = new Set(serviceSummaries.map((summary) => summary.lineRef.trim().toUpperCase()));

  const [weatherResult, liveResults] = await Promise.all([
    result.scope.latitude !== null && result.scope.longitude !== null
      ? fetchJson<WeatherCurrentResponse>(
          `/weather/current?lat=${encodeURIComponent(String(result.scope.latitude))}&lon=${encodeURIComponent(String(result.scope.longitude))}`
        )
      : Promise.resolve({ data: null, error: null }),
    Promise.all(
      liveOperators.slice(0, 4).map(async (operatorId) => {
        const live = await fetchJson<BusLiveResponse>(`/bus/live/${encodeURIComponent(operatorId)}`);
        return live.data;
      })
    ),
  ]);

  const matchingVehicles = liveResults
    .flatMap((snapshot) => snapshot?.vehicles ?? [])
    .filter((vehicle) => {
      const liveLine = (vehicle.publishedLineName ?? vehicle.lineRef ?? "").trim().toUpperCase();
      return liveLine.length > 0 && serviceLabels.has(liveLine);
    });

  return {
    weather: weatherResult.data,
    live: liveOperators.length > 0
      ? {
          operatorCount: liveOperators.length,
          vehicleCount: matchingVehicles.length,
          monitoredVehicleCount: matchingVehicles.filter((vehicle) => vehicle.monitored === true).length,
          lastUpdated:
            matchingVehicles
              .map((vehicle) => vehicle.recordedAtTime)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1) ?? null,
          matchedLines: Array.from(
            new Set(
              matchingVehicles
                .map((vehicle) => (vehicle.publishedLineName ?? vehicle.lineRef ?? "").trim())
                .filter((value) => value.length > 0)
            )
          ).sort(),
        }
      : null,
  };
}

export default async function BusLocationPage({ searchParams }: BusPageProps) {
  const params = (await searchParams) ?? {};
  const stopId = typeof params.stopId === "string" ? params.stopId.trim() : "";
  const groupId = typeof params.groupId === "string" ? params.groupId.trim() : "";
  const date = typeof params.date === "string" && params.date.trim().length > 0 ? params.date : DEFAULT_BUS_DATE;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const result =
    groupId.length > 0
      ? await fetchJson<BusDeparturesResponse>(
          `/bus/groups/${encodeURIComponent(groupId)}/departures?date=${encodeURIComponent(date)}&windowMinutes=1440&limit=500`
        )
      : stopId.length > 0
      ? await fetchJson<BusDeparturesResponse>(
          `/bus/departures/${encodeURIComponent(stopId)}?date=${encodeURIComponent(date)}&windowMinutes=1440&limit=500`
        )
      : { data: null, error: null };

  const calendarByRoute = new Map<
    string,
    Awaited<ReturnType<typeof fetchJson<BusRouteCalendarResponse>>>
  >();

  if (result.data) {
    const routeIds = Array.from(new Set(result.data.departures.map((departure) => departure.routeId)));
    const calendarEntries = await Promise.all(
      routeIds.map(async (routeId) => {
        const calendar = await fetchJson<BusRouteCalendarResponse>(
          `/bus/routes/${encodeURIComponent(routeId)}/calendar?date=${encodeURIComponent(date)}`
        );
        return [routeId, calendar] as const;
      })
    );

    for (const [routeId, calendar] of calendarEntries) {
      calendarByRoute.set(routeId, calendar);
    }
  }

  const serviceSummaries: ServiceSummary[] = result.data
    ? Array.from(
        result.data.departures.reduce((map, departure) => {
          const lineRef = departure.lineRef ?? getRouteCode(departure.routeId);
          const key = [
            departure.routeId,
            lineRef,
            departure.direction ?? "",
            departure.destinationDisplay ?? "",
          ].join("::");

          const existing = map.get(key);
          if (existing) {
            existing.departures.push(departure);
            return map;
          }

          const calendar = calendarByRoute.get(departure.routeId);
          map.set(key, {
            key,
            routeId: departure.routeId,
            lineRef,
            direction: departure.direction ?? null,
            destinationDisplay: departure.destinationDisplay ?? null,
            operatorName:
              departure.operator?.name ?? departure.operator?.operatorId ?? "Unknown operator",
            departures: [departure],
            calendarData: calendar?.data ?? null,
            calendarError: calendar?.error ?? null,
          });

          return map;
        }, new Map<string, ServiceSummary>())
      )
        .map(([, summary]) => ({
          ...summary,
          departures: [...summary.departures].sort(
            (left, right) =>
              new Date(left.departureTime).getTime() - new Date(right.departureTime).getTime()
          ),
        }))
        .sort(
          (left, right) =>
            new Date(left.departures[0]?.departureTime ?? 0).getTime() -
            new Date(right.departures[0]?.departureTime ?? 0).getTime()
        )
    : [];
  const initialStop = getInitialStop(params, result.data);
  const operationalSnapshot = await loadBusOperationalSnapshot(result.data, serviceSummaries);
  const selectedServiceDate = result.data?.window.serviceDate ?? null;
  const selectedDateIsToday = selectedServiceDate !== null && selectedServiceDate === getLondonTodayDate();
  const liveOperatorIds = Array.from(
    new Set(result.data?.departures.map((departure) => departure.operator?.operatorId).filter((value): value is string => Boolean(value)) ?? [])
  );
  const liveLineLabels = serviceSummaries.map((summary) => summary.lineRef);

  return (
    <AppShell activePath="boards">
      <PageHeader
        eyebrow="Bus board"
        title={result.data?.scope.name ?? "Bus departures"}
        description={
          result.data?.scope.type === "bus_stop_group"
            ? "Scheduled departures across all stands for the full service day."
            : "Scheduled departures for the full service day."
        }
        backHref="/boards"
        backLabel="Back"
      />

      {result.data ? (
        <BoardVisitTracker
          mode="bus"
          location={{
            type: result.data.scope.type,
            id: result.data.scope.id,
            code: result.data.scope.code,
            name: result.data.scope.name,
            localityName: result.data.scope.localityName,
          }}
          href={
            result.data.scope.type === "bus_stop_group"
              ? `/location-info/bus?groupId=${encodeURIComponent(result.data.scope.id)}&date=${encodeURIComponent(date)}&groupName=${encodeURIComponent(result.data.scope.name)}${result.data.scope.localityName ? `&stopLocalityName=${encodeURIComponent(result.data.scope.localityName)}` : ""}`
              : `/location-info/bus?stopId=${encodeURIComponent(result.data.scope.code)}&date=${encodeURIComponent(date)}`
          }
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-4">
          {(groupId.length > 0 || stopId.length > 0) ? <BoardAutoRefresh intervalSeconds={90} /> : null}

          {result.error ? (
            <PanelCard eyebrow="Bus error" title="Unable to load the bus board">
              <p className="text-sm text-rose-700">{result.error}</p>
            </PanelCard>
          ) : null}

          {result.data ? (
            result.data.departures.length === 0 ? (
              <PanelCard eyebrow="No services" title="No scheduled services were found">
                <p className="text-sm text-[var(--muted)]">
                  No scheduled services were returned for this {result.data.scope.type === "bus_stop_group" ? "stop group" : "stop"} on the selected service date.
                </p>
              </PanelCard>
            ) : (
              <>
                <PanelCard eyebrow="Service day" title="What serves this stop today">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Services</div>
                      <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{serviceSummaries.length}</div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departures</div>
                      <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{result.data.count}</div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">First bus</div>
                      <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                        {formatShortTime(result.data.departures[0]?.departureTime ?? null)}
                      </div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                        {result.data.scope.type === "bus_stop_group" ? "Stands" : "Board type"}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                        {result.data.scope.type === "bus_stop_group" ? result.data.scope.memberStopIds?.length ?? 0 : "Single"}
                      </div>
                    </div>
                    <div className="app-stat-tile">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Last bus</div>
                      <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">
                        {formatShortTime(result.data.departures[result.data.departures.length - 1]?.departureTime ?? null)}
                      </div>
                    </div>
                  </div>
                </PanelCard>

                {serviceSummaries.map((summary) => {
                  const badge = getBusBadge(summary.calendarData);

                  return (
                    <PanelCard
                      key={summary.key}
                      eyebrow="Service"
                      title={`${summary.lineRef} · ${summary.destinationDisplay ?? "Destination unavailable"}`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="text-sm text-[var(--muted)]">
                            {summary.operatorName}
                            {summary.direction ? ` · ${summary.direction}` : ""}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="app-stat-tile">
                              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">First</div>
                              <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                                {formatShortTime(summary.departures[0]?.departureTime ?? null)}
                              </div>
                            </div>
                            <div className="app-stat-tile">
                              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Last</div>
                              <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                                {formatShortTime(summary.departures[summary.departures.length - 1]?.departureTime ?? null)}
                              </div>
                            </div>
                            <div className="app-stat-tile">
                              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Calls</div>
                              <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
                                {summary.departures.length}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${badge.className}`}>
                          {badge.label}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {summary.departures.slice(0, 12).map((departure) => (
                          <span
                            key={departure.scheduleId}
                            className="rounded-full border border-[var(--outline)] bg-[var(--surface-accent)] px-3 py-1 text-sm font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
                          >
                            {formatShortTime(departure.departureTime)}
                          </span>
                        ))}
                        {summary.departures.length > 12 ? (
                          <span className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-sm font-semibold text-[var(--muted)]">
                            +{summary.departures.length - 12} more
                          </span>
                        ) : null}
                      </div>

                      {summary.calendarData ? (
                        <div className="mt-4 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
                          Runs {summary.calendarData.calendar.validFrom ? formatShortDate(summary.calendarData.calendar.validFrom) : "now"} to{" "}
                          {summary.calendarData.calendar.validTo ? formatShortDate(summary.calendarData.calendar.validTo) : "open"}
                        </div>
                      ) : summary.calendarError ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                          Calendar lookup failed: {summary.calendarError}
                        </div>
                      ) : null}
                    </PanelCard>
                  );
                })}
              </>
            )
          ) : (
            <PanelCard eyebrow="Bus board" title="Search for a stop">
              <p className="text-sm text-[var(--muted)]">
                Search by stop name or grouped hub name and pick the correct result from the suggestions to load the scheduled stop board.
              </p>
            </PanelCard>
          )}
        </div>

        <div className="space-y-6">
          <PanelCard eyebrow="Controls" title="Load another stop">
            <BusBoardControls initialStop={initialStop} initialDate={date} query={query} />
          </PanelCard>

          <PanelCard eyebrow="More details" title="Live context and board information">
            <BusBoardStatusPanel
              latitude={result.data?.scope.latitude ?? null}
              longitude={result.data?.scope.longitude ?? null}
              operatorIds={liveOperatorIds}
              lineLabels={liveLineLabels}
              selectedServiceDate={selectedServiceDate}
              scopeType={result.data?.scope.type ?? "bus_stop"}
              dataStateLastUpdated={result.data?.dataState.lastUpdated ?? null}
              serviceDate={result.data?.window.serviceDate ?? null}
              scheduledDepartureCount={result.data?.count ?? 0}
              initialWeather={operationalSnapshot.weather}
              initialLive={operationalSnapshot.live}
            />
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
