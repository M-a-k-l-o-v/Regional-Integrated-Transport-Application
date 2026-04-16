import express from "express";
import cors from "cors";
import { prisma } from "./infrastructure/orm/prisma/client";
import { z } from "zod";
import { env } from "./config/env";
import { JourneyPlanningService } from "./services/journeys/JourneyPlanningService";
import { JourneyLegDetailService } from "./services/journeys/JourneyLegDetailService";
import { JourneyOperationalStatusService } from "./services/journeys/JourneyOperationalStatusService";
import { getBusServiceLabel } from "./services/journeys/helpers";
import { getBusStopGroup, searchBusStopGroups } from "./services/busStopGroups";
import { TransportServerClient } from "./infrastructure/apiClients/TransportServerClient";
import { NationalHighwaysClient } from "./infrastructure/apiClients/NationalHighwaysClient";
import { StationFacilitiesService } from "./services/stations/StationFacilitiesService";
import { LiveMovementStore } from "./infrastructure/liveData/LiveMovementStore";
import { BusLiveDelayStore } from "./infrastructure/liveData/BusLiveDelayStore";
import { cacheGet, cacheSet } from "./infrastructure/cache/RedisCache";

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseRailTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})(\d{2})/);
  if (!match) return null;
  const hh = Number.parseInt(match[1], 10);
  const mm = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 47 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatRailTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

function getDayIndexMondayZero(date: Date): number {
  const jsDay = date.getDay(); // 0=Sun ... 6=Sat
  return (jsDay + 6) % 7; // 0=Mon ... 6=Sun
}

function parseIsoDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toUtcDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

function getCalendarRunsForDate(
  calendar:
    | {
        runsMon: boolean;
        runsTue: boolean;
        runsWed: boolean;
        runsThu: boolean;
        runsFri: boolean;
        runsSat: boolean;
        runsSun: boolean;
      }
    | null
    | undefined,
  date: Date
): boolean {
  if (!calendar) return true;
  const dayIdx = getDayIndexMondayZero(date);
  if (dayIdx === 0) return calendar.runsMon;
  if (dayIdx === 1) return calendar.runsTue;
  if (dayIdx === 2) return calendar.runsWed;
  if (dayIdx === 3) return calendar.runsThu;
  if (dayIdx === 4) return calendar.runsFri;
  if (dayIdx === 5) return calendar.runsSat;
  return calendar.runsSun;
}

function searchRank(qLower: string, name: string, code: string): number {
  const nameLower = name.toLowerCase();
  const codeLower = code.toLowerCase();

  if (codeLower === qLower) return 0;
  if (nameLower === qLower) return 1;
  if (codeLower.startsWith(qLower)) return 2;
  if (nameLower.startsWith(qLower)) return 3;
  if (nameLower.includes(` ${qLower}`)) return 4;
  if (nameLower.includes(qLower)) return 5;
  return 6;
}

function searchTypePriority(type: "station" | "bus_stop" | "bus_stop_group"): number {
  if (type === "bus_stop_group") return 0;
  if (type === "station") return 1;
  return 2;
}

function buildScheduledDataState(lastUpdated: Date | null | undefined) {
  const updated = lastUpdated ?? null;

  return {
    mode: "scheduled" as const,
    isLive: false,
    fallback: true,
    lastUpdated: updated ? updated.toISOString() : null,
  };
}

function getRailStpPriority(stpIndicator: string | null | undefined): number {
  if (stpIndicator === "O") return 3;
  if (stpIndicator === "N") return 2;
  if (stpIndicator === "P") return 1;
  return 0;
}

function getRailDepartureGroupKey(row: {
  trainUid: string;
  scheduledDepartureRaw: string | null;
  _sortMinutes: number;
}): string {
  return `${row.trainUid}::${row.scheduledDepartureRaw ?? row._sortMinutes}`;
}

function getRailStopDisplayName(stop: {
  station: { name: string } | null;
  tiploc: {
    tpsDescription: string | null;
    description: string | null;
    crsCode: string | null;
  };
}): string | null {
  return (
    stop.station?.name ??
    stop.tiploc.tpsDescription ??
    stop.tiploc.description ??
    stop.tiploc.crsCode ??
    null
  );
}

const journeyPlanRequestSchema = z.object({
  origin: z.object({
    type: z.enum(["station", "bus_stop", "bus_stop_group"]),
    id: z.string().min(1),
  }),
  destination: z.object({
    type: z.enum(["station", "bus_stop", "bus_stop_group"]),
    id: z.string().min(1),
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  preference: z.enum(["fastest", "balanced", "fewest_changes"]).default("fastest"),
  maxItineraries: z.coerce.number().int().min(1).max(8).default(3),
  modes: z.array(z.enum(["bus", "rail"])).min(1).optional(),
});

const journeyLegDetailRequestSchema = z.object({
  mode: z.enum(["bus", "rail"]),
  scheduleId: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});

export function createApp(opts: { liveMovementStore?: LiveMovementStore; busLiveDelayStore?: BusLiveDelayStore } = {}) {
  const { liveMovementStore, busLiveDelayStore } = opts;
  const app = express();
  app.use(cors());
  app.use(express.json());
  const transportServerClient = new TransportServerClient(
    env.TRANSPORT_SERVER_BASE_URL,
    env.TRANSPORT_SERVER_TIMEOUT_MS
  );
  const journeyOperationalStatusService = new JourneyOperationalStatusService(prisma, transportServerClient);
  const journeyPlanningService = new JourneyPlanningService(prisma, liveMovementStore, busLiveDelayStore);
  const journeyLegDetailService = new JourneyLegDetailService(prisma, journeyOperationalStatusService);
  const nationalHighwaysClient = new NationalHighwaysClient(env.NATIONAL_HIGHWAYS_API_KEY);
  const stationFacilitiesService = new StationFacilitiesService();

  app.get("/", (_req, res) => {
    res.json({ message: "Backend is running" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/weather/current", async (req, res) => {
    const lat = typeof req.query.lat === "string" ? Number(req.query.lat) : Number.NaN;
    const lon = typeof req.query.lon === "string" ? Number(req.query.lon) : Number.NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: "lat and lon query parameters are required numbers" });
    }

    const weatherCacheKey = `weather:${lat.toFixed(3)}:${lon.toFixed(3)}`;
    const cachedWeather = await cacheGet(weatherCacheKey);
    if (cachedWeather) return res.json(JSON.parse(cachedWeather));

    try {
      const weather = await transportServerClient.getWeather(lat, lon);
      await cacheSet(weatherCacheKey, JSON.stringify(weather), 300); // 5 min
      return res.json(weather);
    } catch (error) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : "Weather lookup failed",
      });
    }
  });

  app.get("/rail/live/departures/:crs", async (req, res) => {
    const crs = req.params.crs?.trim().toUpperCase();
    if (!crs || crs.length !== 3) {
      return res.status(400).json({ error: "crs must be a 3-letter CRS code" });
    }

    const liveBoardCacheKey = `rail:live:${crs}`;
    const cachedBoard = await cacheGet(liveBoardCacheKey);
    if (cachedBoard) return res.json(JSON.parse(cachedBoard));

    try {
      const board = await transportServerClient.getRailDepartures(crs);
      await cacheSet(liveBoardCacheKey, JSON.stringify(board), 30); // 30 sec
      return res.json(board);
    } catch (error) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : "Rail live departures lookup failed",
      });
    }
  });

  app.get("/bus/live/:operatorRef", async (req, res) => {
    const operatorRef = req.params.operatorRef?.trim().toUpperCase();
    if (!operatorRef) {
      return res.status(400).json({ error: "operatorRef is required" });
    }

    try {
      const liveBus = await transportServerClient.getBusLive(operatorRef);
      return res.json(liveBus);
    } catch (error) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : "Bus live positions lookup failed",
      });
    }
  });

  app.get("/search", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return res.status(400).json({ error: "q must be at least 2 characters" });
    }

    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 500);
    const scheduledOnly = req.query.scheduledOnly === "true";
    const searchCacheKey = `search:${q.toLowerCase()}:${limit}:${scheduledOnly}`;
    const cached = await cacheGet(searchCacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const perTypeLimit = Math.max(limit, Math.ceil(limit * 1.5));
    const qLower = q.toLowerCase();
    const groupedStops = searchBusStopGroups(q);
    const groupedMemberStopIds = new Set(groupedStops.flatMap((group) => group.memberStopIds));

    const [busStops, stations] = await Promise.all([
      prisma.busStop.findMany({
        where: {
          OR: [
            { stopId: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { locality: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: {
          stopId: true,
          name: true,
          localityId: true,
          locality: {
            select: {
              name: true,
            },
          },
          latitude: true,
          longitude: true,
        },
        take: perTypeLimit,
      }),
      prisma.station.findMany({
        where: {
          OR: [
            { stationId: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          stationId: true,
          name: true,
          latitude: true,
          longitude: true,
        },
        take: perTypeLimit,
      }),
    ]);

    const candidateCoveredStopIds =
      scheduledOnly
        ? new Set(
            (
              await prisma.busSchedule.findMany({
                where: {
                  stopId: {
                    in: Array.from(
                      new Set([
                        ...busStops.map((stop) => stop.stopId),
                        ...groupedStops.flatMap((group) => group.memberStopIds),
                      ])
                    ),
                  },
                },
                select: {
                  stopId: true,
                },
                distinct: ["stopId"],
              })
            ).map((row) => row.stopId)
          )
        : null;

    const mixed = [
      ...groupedStops.map((group) => ({
        type: "bus_stop_group" as const,
        id: group.groupId,
        code: group.code,
        name: group.name,
        localityId: null as string | null,
        localityName: group.localityName,
        latitude: group.latitude,
        longitude: group.longitude,
        memberStopIds: group.memberStopIds,
      })).filter((group) =>
        !candidateCoveredStopIds || group.memberStopIds.some((stopId) => candidateCoveredStopIds.has(stopId))
      ),
      ...busStops.map((stop) => ({
        type: "bus_stop" as const,
        id: stop.stopId,
        code: stop.stopId,
        name: stop.name,
        localityId: stop.localityId,
        localityName: stop.locality?.name ?? null,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })).filter((stop) => {
        if (candidateCoveredStopIds && !candidateCoveredStopIds.has(stop.id)) return false;
        if (!groupedMemberStopIds.has(stop.id)) return true;
        return stop.code.toLowerCase() === qLower;
      }),
      ...stations.map((station) => ({
        type: "station" as const,
        id: station.stationId,
        code: station.stationId,
        name: station.name,
        localityId: null as string | null,
        localityName: null as string | null,
        latitude: station.latitude,
        longitude: station.longitude,
      })),
    ];

    mixed.sort((a, b) => {
      const busHubBoostA = a.type === "bus_stop_group" && qLower.includes("bus") ? -1 : 0;
      const busHubBoostB = b.type === "bus_stop_group" && qLower.includes("bus") ? -1 : 0;
      if (busHubBoostA !== busHubBoostB) return busHubBoostA - busHubBoostB;

      const rankDiff = searchRank(qLower, a.name, a.code) - searchRank(qLower, b.name, b.code);
      if (rankDiff !== 0) return rankDiff;
      const priorityDiff = searchTypePriority(a.type) - searchTypePriority(b.type);
      if (priorityDiff !== 0) return priorityDiff;
      return a.name.localeCompare(b.name);
    });

    const results = mixed.slice(0, limit);

    const payload = { query: q, count: results.length, results };
    await cacheSet(searchCacheKey, JSON.stringify(payload), 300); // 5 min
    return res.json(payload);
  });

  app.post("/journeys/plan", async (req, res) => {
    const parsed = journeyPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
    }

    if (
      parsed.data.origin.type === parsed.data.destination.type &&
      parsed.data.origin.id === parsed.data.destination.id
    ) {
      return res.status(400).json({ error: "Origin and destination must be different" });
    }

    try {
      const result = await journeyPlanningService.plan(parsed.data);
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Journey planning failed";
      if (message.includes("not found")) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  app.get("/journeys/legs/detail", async (req, res) => {
    const parsed = journeyLegDetailRequestSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
    }

    try {
      const result = await journeyLegDetailService.getDetail(parsed.data);
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Journey leg detail lookup failed";
      if (message.includes("not found")) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  async function loadBusDepartures({
    scope,
    req,
    res,
  }: {
    scope: {
      type: "bus_stop" | "bus_stop_group";
      id: string;
      code: string;
      name: string;
      localityName: string | null;
      latitude: number | null;
      longitude: number | null;
      memberStopIds: string[];
    };
    req: express.Request;
    res: express.Response;
  }) {
    const stopIds = scope.memberStopIds;
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 500);
    const windowMinutes = Math.min(parsePositiveInt(req.query.windowMinutes, 120), 24 * 60);

    const dateRaw = req.query.date;
    const serviceDateFromDateParam = dateRaw !== undefined ? parseIsoDateOnly(dateRaw) : null;
    if (dateRaw !== undefined && (!serviceDateFromDateParam || Number.isNaN(serviceDateFromDateParam.getTime()))) {
      return res.status(400).json({ error: "Invalid date. Expected YYYY-MM-DD" });
    }

    const fromRaw = req.query.from;
    const fromFromParam =
      typeof fromRaw === "string" && fromRaw.trim().length > 0
        ? new Date(fromRaw)
        : null;
    if (fromFromParam && Number.isNaN(fromFromParam.getTime())) {
      return res.status(400).json({ error: "Invalid from datetime" });
    }

    const from = fromFromParam ?? (serviceDateFromDateParam ? toUtcDayRange(serviceDateFromDateParam).start : new Date());
    const serviceDate = serviceDateFromDateParam ?? new Date(from);
    if (!serviceDate || Number.isNaN(serviceDate.getTime())) {
      return res.status(400).json({ error: "Invalid date. Expected YYYY-MM-DD" });
    }

    const serviceDay = toUtcDayRange(serviceDate);
    const windowEnd = new Date(from.getTime() + windowMinutes * 60 * 1000);

    const rows = await prisma.busSchedule.findMany({
      where: {
        stopId: { in: stopIds },
        departureTime: {
          gte: from,
          lte: windowEnd,
        },
      },
      include: {
        route: {
          select: {
            routeId: true,
            operatorId: true,
            operator: {
              select: { operatorId: true, name: true },
            },
          },
        },
        busStop: {
          select: {
            stopId: true,
            name: true,
            localityId: true,
          },
        },
      },
      orderBy: { departureTime: "asc" },
      take: limit,
    });

    const departures = rows.map((row) => ({
      scheduleId: row.scheduleId,
      stopId: row.busStop.stopId,
      stopName: row.busStop.name,
      routeId: row.route.routeId,
      operator: row.route.operator ?? (row.route.operatorId ? { operatorId: row.route.operatorId, name: null } : null),
      departureTime: row.departureTime.toISOString(),
      arrivalTime: row.arrivalTime.toISOString(),
      minutesUntilDeparture: Math.max(0, Math.floor((row.departureTime.getTime() - from.getTime()) / 60000)),
      _updatedAt: row.updatedAt,
    }));
    const routeIds = Array.from(new Set(departures.map((x) => x.routeId)));

    const departureTimes = Array.from(new Set(rows.map((row) => row.departureTime.getTime()))).map((ms) => new Date(ms));
    const journeyStops =
      routeIds.length === 0 || departureTimes.length === 0
        ? []
        : await prisma.busJourneyStop.findMany({
            where: {
              stopId: { in: stopIds },
              departureTime: { in: departureTimes },
              journey: {
                routeId: { in: routeIds },
              },
            },
            select: {
              stopId: true,
              departureTime: true,
              journey: {
                select: {
                  routeId: true,
                  lineRef: true,
                  direction: true,
                  destinationDisplay: true,
                },
              },
            },
            orderBy: [{ departureTime: "asc" }, { stopSeq: "asc" }],
          });

    const journeyByKey = new Map<
      string,
      {
        lineRef: string | null;
        direction: string | null;
        destinationDisplay: string | null;
      }
    >();
    for (const row of journeyStops) {
      const key = `${row.journey.routeId}::${row.stopId}::${row.departureTime.toISOString()}`;
      if (!journeyByKey.has(key)) {
        journeyByKey.set(key, {
          lineRef: row.journey.lineRef,
          direction: row.journey.direction,
          destinationDisplay: row.journey.destinationDisplay,
        });
      }
    }
    const [calendars, exceptions] =
      routeIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.busServiceCalendar.findMany({
              where: {
                routeId: { in: routeIds },
                AND: [
                  { OR: [{ validFrom: null }, { validFrom: { lte: serviceDay.end } }] },
                  { OR: [{ validTo: null }, { validTo: { gte: serviceDay.start } }] },
                ],
              },
              select: {
                routeId: true,
                runsMon: true,
                runsTue: true,
                runsWed: true,
                runsThu: true,
                runsFri: true,
                runsSat: true,
                runsSun: true,
              },
            }),
            prisma.busServiceException.findMany({
              where: {
                routeId: { in: routeIds },
                startDate: { lte: serviceDay.end },
                endDate: { gte: serviceDay.start },
              },
              select: {
                routeId: true,
                isRunning: true,
              },
            }),
          ]);

    const calendarByRoute = new Map(calendars.map((c) => [c.routeId, c]));
    const exceptionsByRoute = new Map<string, Array<{ isRunning: boolean }>>();
    for (const row of exceptions) {
      const list = exceptionsByRoute.get(row.routeId) ?? [];
      list.push({ isRunning: row.isRunning });
      exceptionsByRoute.set(row.routeId, list);
    }

    const filteredDepartures = departures.filter((row) => {
      const calendar = calendarByRoute.get(row.routeId);
      const baseRuns = getCalendarRunsForDate(calendar, serviceDate);
      const ex = exceptionsByRoute.get(row.routeId) ?? [];
      const hasInclude = ex.some((x) => x.isRunning);
      const hasExclude = ex.some((x) => !x.isRunning);
      if (hasInclude) return true;
      if (hasExclude) return false;
      return baseRuns;
    });

    const latestDepartureUpdate = filteredDepartures.reduce<Date | null>(
      (latest, row) => (!latest || row._updatedAt > latest ? row._updatedAt : latest),
      null
    );

    return res.json({
      scope: {
        type: scope.type,
        id: scope.id,
        code: scope.code,
        name: scope.name,
        localityName: scope.localityName,
        latitude: scope.latitude,
        longitude: scope.longitude,
        memberStopIds: scope.type === "bus_stop_group" ? scope.memberStopIds : undefined,
      },
      dataState: buildScheduledDataState(latestDepartureUpdate),
      window: {
        from: from.toISOString(),
        to: windowEnd.toISOString(),
        windowMinutes,
        serviceDate: serviceDay.start.toISOString().slice(0, 10),
      },
      count: filteredDepartures.length,
      departures: filteredDepartures.map(({ _updatedAt, ...row }) => {
        const journey = journeyByKey.get(`${row.routeId}::${row.stopId}::${row.departureTime}`);
        return {
          ...row,
          lineRef: getBusServiceLabel(journey?.lineRef, row.routeId),
          direction: journey?.direction ?? null,
          destinationDisplay: journey?.destinationDisplay ?? null,
        };
      }),
    });
  }

  app.get("/bus/departures/:stopId", async (req, res) => {
    const stopId = req.params.stopId?.trim();
    if (!stopId) {
      return res.status(400).json({ error: "stopId is required" });
    }

    const stop = await prisma.busStop.findUnique({
      where: { stopId },
      select: {
        stopId: true,
        name: true,
        latitude: true,
        longitude: true,
        locality: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!stop) {
      return res.status(404).json({ error: `Bus stop not found: ${stopId}` });
    }

    return loadBusDepartures({
      scope: {
        type: "bus_stop",
        id: stop.stopId,
        code: stop.stopId,
        name: stop.name,
        localityName: stop.locality?.name ?? null,
        latitude: stop.latitude,
        longitude: stop.longitude,
        memberStopIds: [stop.stopId],
      },
      req,
      res,
    });
  });

  app.get("/bus/groups/:groupId/departures", async (req, res) => {
    const groupId = req.params.groupId?.trim();
    if (!groupId) {
      return res.status(400).json({ error: "groupId is required" });
    }

    const group = getBusStopGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: `Bus stop group not found: ${groupId}` });
    }

    const groupStops = await prisma.busStop.findMany({
      where: {
        stopId: { in: group.memberStopIds },
      },
      select: {
        latitude: true,
        longitude: true,
      },
    });

    const mappedGroupStops = groupStops.filter(
      (stop): stop is { latitude: number; longitude: number } =>
        stop.latitude !== null && stop.longitude !== null
    );
    const groupLatitude =
      mappedGroupStops.length > 0
        ? mappedGroupStops.reduce((sum, stop) => sum + stop.latitude, 0) / mappedGroupStops.length
        : null;
    const groupLongitude =
      mappedGroupStops.length > 0
        ? mappedGroupStops.reduce((sum, stop) => sum + stop.longitude, 0) / mappedGroupStops.length
        : null;

    return loadBusDepartures({
      scope: {
        type: "bus_stop_group",
        id: group.groupId,
        code: group.code,
        name: group.name,
        localityName: group.localityName,
        latitude: groupLatitude,
        longitude: groupLongitude,
        memberStopIds: group.memberStopIds,
      },
      req,
      res,
    });
  });

  app.get("/bus/routes/:routeId/calendar", async (req, res) => {
    const routeId = req.params.routeId?.trim();
    if (!routeId) {
      return res.status(400).json({ error: "routeId is required" });
    }

    const dateRaw = req.query.date;
    const resolvedDate = dateRaw !== undefined ? parseIsoDateOnly(dateRaw) : new Date();
    if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date. Expected YYYY-MM-DD" });
    }
    const day = toUtcDayRange(resolvedDate);

    const [calendar, exceptions] = await Promise.all([
      prisma.busServiceCalendar.findUnique({
        where: { routeId },
        select: {
          routeId: true,
          serviceCode: true,
          validFrom: true,
          validTo: true,
          runsMon: true,
          runsTue: true,
          runsWed: true,
          runsThu: true,
          runsFri: true,
          runsSat: true,
          runsSun: true,
          sourceFile: true,
          updatedAt: true,
        },
      }),
      prisma.busServiceException.findMany({
        where: {
          routeId,
          startDate: { lte: day.end },
          endDate: { gte: day.start },
        },
        select: {
          startDate: true,
          endDate: true,
          isRunning: true,
          reason: true,
          sourceFile: true,
        },
        orderBy: { startDate: "asc" },
      }),
    ]);

    if (!calendar) {
      return res.status(404).json({ error: `Bus service calendar not found for route: ${routeId}` });
    }

    const inRange =
      (calendar.validFrom === null || calendar.validFrom <= day.end) &&
      (calendar.validTo === null || calendar.validTo >= day.start);
    const baseRuns = inRange && getCalendarRunsForDate(calendar, resolvedDate);
    const hasInclude = exceptions.some((x) => x.isRunning);
    const hasExclude = exceptions.some((x) => !x.isRunning);
    const runsOnDate = hasInclude ? true : hasExclude ? false : baseRuns;

    return res.json({
      routeId,
      date: day.start.toISOString().slice(0, 10),
      runsOnDate,
      dataState: buildScheduledDataState(calendar.updatedAt),
      calendar,
      exceptions: exceptions.map((x) => ({
        startDate: x.startDate.toISOString().slice(0, 10),
        endDate: x.endDate.toISOString().slice(0, 10),
        isRunning: x.isRunning,
        reason: x.reason,
        sourceFile: x.sourceFile,
      })),
    });
  });

  app.get("/rail/departures/:crs", async (req, res) => {
    const crs = req.params.crs?.trim().toUpperCase();
    if (!crs || crs.length !== 3) {
      return res.status(400).json({ error: "crs must be a 3-letter CRS code" });
    }

    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const windowMinutes = Math.min(parsePositiveInt(req.query.windowMinutes, 180), 24 * 60);

    const fromRaw = req.query.from;
    const from =
      typeof fromRaw === "string" && fromRaw.trim().length > 0
        ? new Date(fromRaw)
        : new Date();

    if (Number.isNaN(from.getTime())) {
      return res.status(400).json({ error: "Invalid from datetime" });
    }

    const station = await prisma.station.findUnique({
      where: { stationId: crs },
      select: { stationId: true, name: true, latitude: true, longitude: true },
    });

    if (!station) {
      return res.status(404).json({ error: `Station not found: ${crs}` });
    }

    const serviceDate = new Date(from);
    serviceDate.setHours(0, 0, 0, 0);
    const dayIndex = getDayIndexMondayZero(serviceDate);
    const fromMinutes = from.getHours() * 60 + from.getMinutes();

    const candidateStops = await prisma.railServiceStop.findMany({
      where: {
        stationId: crs,
        schedule: {
          is: {
            scheduleStartDate: { lte: serviceDate },
            scheduleEndDate: { gte: serviceDate },
          },
        },
      },
      select: {
        stopId: true,
        scheduleId: true,
        locationType: true,
        platform: true,
        departure: true,
        publicDeparture: true,
        arrival: true,
        publicArrival: true,
        pass: true,
        schedule: {
          select: {
            trainUid: true,
            stpIndicator: true,
            atocCode: true,
            trainStatus: true,
            scheduleDaysRuns: true,
            updatedAt: true,
          },
        },
      },
      take: 5000,
    });

    const preliminaryDepartures = candidateStops
      .filter((stop) => {
        const runs = stop.schedule.scheduleDaysRuns ?? "";
        if (runs.length >= 7 && runs[dayIndex] !== "1") return false;
        return true;
      })
      .map((stop) => {
        const rawTime = stop.publicDeparture;

        const depMinutes = parseRailTimeToMinutes(rawTime);
        if (depMinutes === null) return null;

        const minsUntil = depMinutes - fromMinutes;
        if (minsUntil < 0 || minsUntil > windowMinutes) return null;

        return {
          stopId: stop.stopId,
          scheduleId: stop.scheduleId,
          trainUid: stop.schedule.trainUid,
          stpIndicator: stop.schedule.stpIndicator,
          operatorCode: stop.schedule.atocCode,
          status: stop.schedule.trainStatus,
          locationType: stop.locationType,
          platform: stop.platform,
          scheduledDepartureRaw: rawTime,
          scheduledDeparture: formatRailTime(rawTime),
          minutesUntilDeparture: minsUntil,
          source: "timetable",
          isLive: false,
          _updatedAt: stop.schedule.updatedAt,
          _sortMinutes: depMinutes,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a._sortMinutes - b._sortMinutes);

    const candidateTrainUids = Array.from(new Set(preliminaryDepartures.map((row) => row.trainUid)));
    const cancellationSchedules =
      candidateTrainUids.length === 0
        ? []
        : await prisma.railServiceSchedule.findMany({
            where: {
              trainUid: { in: candidateTrainUids },
              stpIndicator: "C",
              scheduleStartDate: { lte: serviceDate },
              scheduleEndDate: { gte: serviceDate },
            },
            select: {
              trainUid: true,
              scheduleDaysRuns: true,
            },
          });

    const cancelledPermanentTrainUids = new Set(
      cancellationSchedules
        .filter((schedule) => {
          const runs = schedule.scheduleDaysRuns ?? "";
          return !(runs.length >= 7 && runs[dayIndex] !== "1");
        })
        .map((schedule) => schedule.trainUid)
    );

    const departuresByKey = new Map<string, Array<(typeof preliminaryDepartures)[number]>>();
    for (const row of preliminaryDepartures) {
      const key = getRailDepartureGroupKey(row);
      const list = departuresByKey.get(key) ?? [];
      list.push(row);
      departuresByKey.set(key, list);
    }

    const departures = Array.from(departuresByKey.values())
      .map((group) => {
        const chosen = [...group].sort((a, b) => {
          const priorityDiff = getRailStpPriority(b.stpIndicator) - getRailStpPriority(a.stpIndicator);
          if (priorityDiff !== 0) return priorityDiff;
          const updatedDiff = b._updatedAt.getTime() - a._updatedAt.getTime();
          if (updatedDiff !== 0) return updatedDiff;
          return a.scheduleId.localeCompare(b.scheduleId);
        })[0];

        if (chosen.stpIndicator === "P" && cancelledPermanentTrainUids.has(chosen.trainUid)) {
          return null;
        }

        return chosen;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a._sortMinutes - b._sortMinutes)
      .slice(0, limit);

    const scheduleIds = Array.from(new Set(departures.map((row) => row.scheduleId)));
    const scheduleStops =
      scheduleIds.length === 0
        ? []
        : await prisma.railServiceStop.findMany({
            where: {
              scheduleId: { in: scheduleIds },
            },
            select: {
              scheduleId: true,
              locationType: true,
              publicArrival: true,
              publicDeparture: true,
              station: {
                select: {
                  stationId: true,
                  name: true,
                },
              },
              tiploc: {
                select: {
                  crsCode: true,
                  description: true,
                  tpsDescription: true,
                },
              },
            },
            orderBy: [{ scheduleId: "asc" }, { stopSeq: "desc" }],
          });

    const destinationByScheduleId = new Map<string, string>();
    const fallbackDestinationByScheduleId = new Map<string, string>();
    for (const stop of scheduleStops) {
      const fallback = getRailStopDisplayName(stop);
      if (fallback && !fallbackDestinationByScheduleId.has(stop.scheduleId)) {
        fallbackDestinationByScheduleId.set(stop.scheduleId, fallback);
      }

      if (destinationByScheduleId.has(stop.scheduleId)) continue;

      const hasPublicCall = Boolean(stop.publicArrival || stop.publicDeparture);
      if (!hasPublicCall) continue;

      const passengerFacingDestination = getRailStopDisplayName(stop);
      if (passengerFacingDestination) {
        destinationByScheduleId.set(stop.scheduleId, passengerFacingDestination);
      }
    }

    for (const [scheduleId, fallback] of fallbackDestinationByScheduleId) {
      if (!destinationByScheduleId.has(scheduleId)) {
        destinationByScheduleId.set(scheduleId, fallback);
      }
    }

    const latestRailUpdate = departures.reduce<Date | null>(
      (latest, row) => (!latest || row._updatedAt > latest ? row._updatedAt : latest),
      null
    );

    const windowEnd = new Date(from.getTime() + windowMinutes * 60 * 1000);

    // ── Fetch aggregate AI reliability score ──────────────────────────
    const reliability = await prisma.reliabilityScore.findFirst({
      where: { routeId: "AI_STATS_AGG" },
      orderBy: { calculatedAt: "desc" },
      select: { score: true, confidenceLevel: true },
    });

    // Overlay live movement data if the STOMP stream is active
    let stationStanox: string | null = null;
    let liveOverlayCount = 0;
    if (liveMovementStore && liveMovementStore.size > 0) {
      const tiploc = await prisma.railTiploc.findFirst({
        where: { crsCode: crs },
        select: { stanox: true },
      });
      stationStanox = tiploc?.stanox ?? null;
    }

    const mappedDepartures = departures.map(({ _sortMinutes, _updatedAt, ...row }) => {
      const base = {
        ...row,
        destination: destinationByScheduleId.get(row.scheduleId) ?? null,
        reliability: reliability ? {
          score: reliability.score,
          confidenceLevel: reliability.confidenceLevel,
        } : null,
        liveDelay: null as null | {
          timetableVariationMinutes: number | null;
          variationStatus: string | null;
          platform: string | null;
          actualTimestamp: string | null;
        },
      };

      if (stationStanox && liveMovementStore) {
        const movement = liveMovementStore.findDeparture(stationStanox, _sortMinutes);
        if (movement) {
          liveOverlayCount += 1;
          base.liveDelay = {
            timetableVariationMinutes: movement.timetableVariationMinutes,
            variationStatus: movement.variationStatus,
            platform: movement.platform ?? row.platform,
            actualTimestamp: movement.actualTimestampMs
              ? new Date(movement.actualTimestampMs).toISOString()
              : null,
          };
        }
      }

      return base;
    });

    const isLive = liveOverlayCount > 0;

    return res.json({
      station,
      dataState: isLive
        ? { mode: "live" as const, isLive: true, fallback: false, lastUpdated: new Date().toISOString(), liveOverlayCount }
        : buildScheduledDataState(latestRailUpdate),
      window: {
        from: from.toISOString(),
        to: windowEnd.toISOString(),
        windowMinutes,
        serviceDate: serviceDate.toISOString().slice(0, 10),
      },
      count: mappedDepartures.length,
      departures: mappedDepartures,
    });
  });

  // ── Rail delay stats (FR-06) ─────────────────────────────────────────────
  // GET /rail/delay-stats/:stanox  — aggregated delay distribution for a station
  // GET /rail/delay-log            — raw movement log (paginated)
  app.get("/rail/delay-stats/:stanox", async (req, res) => {
    const stanox = req.params.stanox?.trim();
    if (!stanox) return res.status(400).json({ error: "stanox required" });

    const days = Math.min(parsePositiveInt(req.query.days, 7), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.railMovementLog.findMany({
      where: {
        stanox,
        eventType: "DEPARTURE",
        receivedAt: { gte: since },
        timetableVariationMinutes: { not: null },
      },
      select: { timetableVariationMinutes: true, variationStatus: true, receivedAt: true },
      orderBy: { receivedAt: "asc" },
    });

    const total = logs.length;
    if (total === 0) {
      return res.json({ stanox, days, total: 0, onTime: 0, late: 0, early: 0, avgDelayMinutes: null, buckets: [] });
    }

    const counts = { onTime: 0, late: 0, early: 0 };
    let delaySum = 0;
    const buckets = new Map<string, { date: string; count: number; avgDelay: number; sum: number }>();

    for (const log of logs) {
      const v = log.timetableVariationMinutes as number;
      delaySum += v;
      if (v <= 0) counts.early += 1;
      else if (v <= 1) counts.onTime += 1;
      else counts.late += 1;

      const date = log.receivedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(date) ?? { date, count: 0, avgDelay: 0, sum: 0 };
      bucket.count += 1;
      bucket.sum += v;
      bucket.avgDelay = Math.round((bucket.sum / bucket.count) * 10) / 10;
      buckets.set(date, bucket);
    }

    return res.json({
      stanox,
      days,
      total,
      onTime: counts.onTime,
      late: counts.late,
      early: counts.early,
      avgDelayMinutes: Math.round((delaySum / total) * 10) / 10,
      buckets: Array.from(buckets.values()),
    });
  });

  app.get("/rail/delay-log", async (req, res) => {
    const stanox = typeof req.query.stanox === "string" ? req.query.stanox.trim() : undefined;
    const limit = Math.min(parsePositiveInt(req.query.limit, 100), 500);
    const offset = parsePositiveInt(req.query.offset, 0) - 1 || 0;
    const days = Math.min(parsePositiveInt(req.query.days, 1), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.railMovementLog.findMany({
      where: {
        ...(stanox ? { stanox } : {}),
        receivedAt: { gte: since },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        trainId: true,
        stanox: true,
        eventType: true,
        timetableVariationMinutes: true,
        variationStatus: true,
        platform: true,
        actualTimestampMs: true,
        receivedAt: true,
      },
    });

    return res.json({
      count: logs.length,
      logs: logs.map((l) => ({
        ...l,
        actualTimestampMs: l.actualTimestampMs !== null ? Number(l.actualTimestampMs) : null,
      })),
    });
  });

  // ── Road VMS (Variable Message Signs) ────────────────────────────────────
  app.get("/road/vms", async (req, res) => {
    const road = typeof req.query.road === "string" && req.query.road.trim().length > 0
      ? req.query.road.trim().toUpperCase()
      : "M6";

    const cacheKey = `vms:${road}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    try {
      const snapshot = await nationalHighwaysClient.getVmsSigns(road);
      await cacheSet(cacheKey, JSON.stringify(snapshot), 300); // 5 min TTL
      return res.json(snapshot);
    } catch (error) {
      return res.status(502).json({
        error: error instanceof Error ? error.message : "VMS data fetch failed",
      });
    }
  });

  // ── Station facilities ───────────────────────────────────────────────────
  app.get("/rail/stations/:crs/facilities", async (req, res) => {
    const crs = req.params.crs.trim().toUpperCase();
    if (crs.length < 2 || crs.length > 4) {
      return res.status(400).json({ error: "Invalid CRS code" });
    }

    const cacheKey = `station-facilities:${crs}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const snapshot = stationFacilitiesService.getFacilities(crs);
    await cacheSet(cacheKey, JSON.stringify(snapshot), 3600); // 1 hour TTL
    return res.json(snapshot);
  });

  return app;
}
