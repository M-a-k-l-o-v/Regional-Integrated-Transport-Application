import { Prisma, PrismaClient } from "@prisma/client";
import { BusLiveDelayStore, dateToLocalHHMM } from "../../infrastructure/liveData/BusLiveDelayStore";
import { GraphSlice, JourneyNode, TransitEdge } from "./types";
import { getBusServiceLabel, getLocalDayRange, toNodeId } from "./helpers";

// Day-of-week field names matching BusServiceCalendar columns.
// getDay() returns 0=Sun…6=Sat; we map to the Prisma field name.
const DAY_FIELD: Record<number, keyof Prisma.BusServiceCalendarWhereInput> = {
  0: "runsSun",
  1: "runsMon",
  2: "runsTue",
  3: "runsWed",
  4: "runsThu",
  5: "runsFri",
  6: "runsSat",
};

function normaliseStopTimes(stops: Array<{ arrivalTime: Date; departureTime: Date }>): number[] | null {
  if (stops.length === 0) return [];

  const adjusted: number[] = [stops[0].departureTime.getTime()];
  for (let index = 1; index < stops.length; index += 1) {
    const rawMs = stops[index].arrivalTime.getTime();
    const previousMs = adjusted[index - 1];

    if (rawMs < previousMs) {
      return null;
    }

    adjusted.push(rawMs === previousMs ? previousMs + 1000 : rawMs);
  }

  return adjusted;
}

// Re-maps a stop timestamp from its original ingested date to the requested date.
// Uses an offset relative to the journey's serviceDate (= local midnight stored in UTC)
// so that the local clock time is preserved correctly across DST boundaries.
function remapTime(stopTimeMs: number, journeyServiceDateMs: number, requestedDayStartMs: number): Date {
  const offsetMs = stopTimeMs - journeyServiceDateMs;
  return new Date(requestedDayStartMs + offsetMs);
}

type JourneyRow = {
  journeyId: string;
  routeId: string;
  lineRef: string | null;
  direction: string | null;
  destinationDisplay: string | null;
  updatedAt: Date;
  serviceDate: Date;
  operatorId: string | null;
  operatorName: string | null;
};

type StopRow = {
  journeyId: string;
  stopId: string;
  stopSeq: number;
  arrivalTime: Date;
  departureTime: Date;
};

export class BusRoutingAdapter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly busLiveDelayStore?: BusLiveDelayStore,
  ) {}

  async build(dateString: string): Promise<GraphSlice> {
    const { dayStart, nextDayStart } = getLocalDayRange(dateString);
    const dayOfWeek = dayStart.getDay();
    const dayField = DAY_FIELD[dayOfWeek];

    // ── 1. Find routes whose calendar covers this day of week + date range ────
    const calendars = await this.prisma.busServiceCalendar.findMany({
      where: {
        [dayField]: true,
        validFrom: { lte: nextDayStart },
        OR: [{ validTo: null }, { validTo: { gte: dayStart } }],
      },
      select: { routeId: true },
    });

    if (calendars.length === 0) {
      return { nodes: [], transitEdges: [], latestUpdatedAtMs: null };
    }

    const calendarRouteIds = calendars.map((c) => c.routeId);

    // ── 2. Remove routes cancelled by explicit date-range exceptions.
    //       Bank holiday exceptions are advisory only — operators often run
    //       amended timetables that aren't published in the BODS XML feed. ────
    const exceptions = await this.prisma.busServiceException.findMany({
      where: {
        routeId: { in: calendarRouteIds },
        startDate: { lte: nextDayStart },
        endDate: { gte: dayStart },
        isRunning: false,
      },
      select: { routeId: true, reason: true },
    });

    const cancelledIds = new Set<string>();
    const bankHolidayAdvisoryIds = new Set<string>();
    for (const exc of exceptions) {
      if (exc.reason.startsWith("bank_holiday")) {
        bankHolidayAdvisoryIds.add(exc.routeId);
      } else {
        cancelledIds.add(exc.routeId);
      }
    }

    const validRouteIds = calendarRouteIds.filter((id) => !cancelledIds.has(id));

    if (validRouteIds.length === 0) {
      return { nodes: [], transitEdges: [], latestUpdatedAtMs: null };
    }

    // ── 3. Get the most recently ingested journey template per (route, journey
    //       pattern). DISTINCT ON ensures we take only the latest serviceDate
    //       version so stale timetables don't bleed through. ─────────────────
    const journeyRows = await this.prisma.$queryRaw<JourneyRow[]>`
      SELECT DISTINCT ON (j."routeId", j."vehicleJourneyCode")
        j."journeyId",
        j."routeId",
        j."lineRef",
        j."direction",
        j."destinationDisplay",
        j."updatedAt",
        j."serviceDate",
        r."operatorId",
        o."name" AS "operatorName"
      FROM "BusJourney" j
      LEFT JOIN "BusRoute" r ON r."routeId" = j."routeId"
      LEFT JOIN "Operator" o ON o."operatorId" = r."operatorId"
      WHERE j."routeId" = ANY(${validRouteIds})
        AND j."timingQuality" IN ('EXACT', 'REPAIRED', 'ESTIMATED')
        AND j."nonPositiveEdgeCount" = 0
      ORDER BY j."routeId", j."vehicleJourneyCode", j."serviceDate" DESC
    `;

    if (journeyRows.length === 0) {
      return { nodes: [], transitEdges: [], latestUpdatedAtMs: null };
    }

    const journeyIds = journeyRows.map((j) => j.journeyId);
    const journeyMap = new Map(journeyRows.map((j) => [j.journeyId, j]));

    // ── 4. Fetch stop times for all template journeys ─────────────────────────
    const stopRows = await this.prisma.$queryRaw<StopRow[]>`
      SELECT js."journeyId", js."stopId", js."stopSeq",
             js."arrivalTime", js."departureTime"
      FROM "BusJourneyStop" js
      WHERE js."journeyId" = ANY(${journeyIds})
      ORDER BY js."journeyId", js."stopSeq"
    `;

    // Group stops by journey
    const stopsByJourney = new Map<string, StopRow[]>();
    for (const row of stopRows) {
      const existing = stopsByJourney.get(row.journeyId);
      if (existing) {
        existing.push(row);
      } else {
        stopsByJourney.set(row.journeyId, [row]);
      }
    }

    // ── 5. Build transit edges, re-mapping stop times to the requested date ──
    const stopIds = new Set<string>();
    const transitEdges: TransitEdge[] = [];
    let latestUpdatedAtMs: number | null = null;

    for (const journey of journeyRows) {
      latestUpdatedAtMs =
        latestUpdatedAtMs === null
          ? journey.updatedAt.getTime()
          : Math.max(latestUpdatedAtMs, journey.updatedAt.getTime());

      const rawStops = stopsByJourney.get(journey.journeyId);
      if (!rawStops || rawStops.length < 2) continue;

      const serviceDateMs = journey.serviceDate.getTime();
      const requestedDayStartMs = dayStart.getTime();

      const remapped = rawStops.map((s) => ({
        stopId: s.stopId,
        arrivalTime: remapTime(s.arrivalTime.getTime(), serviceDateMs, requestedDayStartMs),
        departureTime: remapTime(s.departureTime.getTime(), serviceDateMs, requestedDayStartMs),
      }));

      // ── Apply live delay from SIRI-VM MonitoredCall ───────────────────────
      let appliedDelayMinutes: number | null = null;
      if (this.busLiveDelayStore && remapped.length > 0) {
        const lineLabel = getBusServiceLabel(journey.lineRef, journey.routeId);
        const originDeparture = remapped[0].departureTime;
        const delayMinutes = this.busLiveDelayStore.findDelay(lineLabel, originDeparture);
        if (delayMinutes !== null && delayMinutes !== 0) {
          appliedDelayMinutes = delayMinutes;
          const delayMs = delayMinutes * 60_000;
          for (const stop of remapped) {
            stop.arrivalTime = new Date(stop.arrivalTime.getTime() + delayMs);
            stop.departureTime = new Date(stop.departureTime.getTime() + delayMs);
          }
        }
      }

      const adjustedTimes = normaliseStopTimes(remapped);
      if (!adjustedTimes) continue;

      for (const s of remapped) {
        stopIds.add(s.stopId);
      }

      for (let i = 0; i < remapped.length - 1; i++) {
        const departureTimeMs = adjustedTimes[i];
        const arrivalTimeMs = adjustedTimes[i + 1];
        if (arrivalTimeMs <= departureTimeMs) continue;

        transitEdges.push({
          mode: "bus",
          fromNodeId: toNodeId("bus_stop", remapped[i].stopId),
          toNodeId: toNodeId("bus_stop", remapped[i + 1].stopId),
          departureTimeMs,
          arrivalTimeMs,
          durationMinutes: Math.max(1, Math.ceil((arrivalTimeMs - departureTimeMs) / 60000)),
          serviceKey: `bus:${journey.journeyId}`,
          line: getBusServiceLabel(journey.lineRef, journey.routeId),
          operator: journey.operatorName ?? journey.operatorId ?? null,
          routeId: journey.routeId,
          scheduleId: journey.journeyId,
          liveDelayMinutes: appliedDelayMinutes,
          bankHolidayAdvisory: bankHolidayAdvisoryIds.has(journey.routeId) || undefined,
        });
      }
    }

    // Deduplicate edges that represent the same physical trip ingested multiple times.
    // Multiple VJ codes can exist for the same departure when data was ingested from
    // multiple source files. Keep only the first seen edge per
    // (fromNodeId, toNodeId, departureTimeMs, line) combination.
    const edgeSeen = new Set<string>();
    const uniqueEdges: typeof transitEdges = [];
    for (const edge of transitEdges) {
      const key = `${edge.fromNodeId}|${edge.toNodeId}|${edge.departureTimeMs}|${edge.line ?? ""}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      uniqueEdges.push(edge);
    }
    const deduplicatedEdges = uniqueEdges;

    const stops =
      stopIds.size === 0
        ? []
        : await this.prisma.busStop.findMany({
            where: { stopId: { in: Array.from(stopIds) } },
            select: { stopId: true, name: true, latitude: true, longitude: true },
          });

    const nodes: JourneyNode[] = stops.map((stop) => ({
      nodeId: toNodeId("bus_stop", stop.stopId),
      type: "bus_stop",
      id: stop.stopId,
      code: stop.stopId,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }));

    return { nodes, transitEdges: deduplicatedEdges, latestUpdatedAtMs };
  }
}
