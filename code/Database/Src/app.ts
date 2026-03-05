import express from "express";
import cors from "cors";
import { prisma } from "./infrastructure/orm/prisma/client";

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

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ message: "Backend is running" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/search", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return res.status(400).json({ error: "q must be at least 2 characters" });
    }

    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const perTypeLimit = Math.max(limit, Math.ceil(limit * 1.5));
    const qLower = q.toLowerCase();

    const [busStops, stations] = await Promise.all([
      prisma.busStop.findMany({
        where: {
          OR: [
            { stopId: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          stopId: true,
          name: true,
          localityId: true,
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
        },
        take: perTypeLimit,
      }),
    ]);

    const mixed = [
      ...busStops.map((stop) => ({
        type: "bus_stop" as const,
        id: stop.stopId,
        code: stop.stopId,
        name: stop.name,
        localityId: stop.localityId,
      })),
      ...stations.map((station) => ({
        type: "station" as const,
        id: station.stationId,
        code: station.stationId,
        name: station.name,
        localityId: null as string | null,
      })),
    ];

    mixed.sort((a, b) => {
      const rankDiff = searchRank(qLower, a.name, a.code) - searchRank(qLower, b.name, b.code);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });

    const results = mixed.slice(0, limit);

    return res.json({
      query: q,
      count: results.length,
      results,
    });
  });

  app.get("/bus/departures/:stopId", async (req, res) => {
    const stopId = req.params.stopId?.trim();
    if (!stopId) {
      return res.status(400).json({ error: "stopId is required" });
    }

    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
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

    const stop = await prisma.busStop.findUnique({
      where: { stopId },
      select: { stopId: true, name: true, localityId: true },
    });

    if (!stop) {
      return res.status(404).json({ error: `Bus stop not found: ${stopId}` });
    }

    const rows = await prisma.busSchedule.findMany({
      where: {
        stopId,
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
      },
      orderBy: { departureTime: "asc" },
      take: limit,
    });

    const departures = rows.map((row) => ({
      scheduleId: row.scheduleId,
      routeId: row.route.routeId,
      operator: row.route.operator ?? (row.route.operatorId ? { operatorId: row.route.operatorId, name: null } : null),
      departureTime: row.departureTime.toISOString(),
      arrivalTime: row.arrivalTime.toISOString(),
      minutesUntilDeparture: Math.max(0, Math.floor((row.departureTime.getTime() - from.getTime()) / 60000)),
    }));

    const routeIds = Array.from(new Set(departures.map((x) => x.routeId)));
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

    return res.json({
      stop,
      window: {
        from: from.toISOString(),
        to: windowEnd.toISOString(),
        windowMinutes,
        serviceDate: serviceDay.start.toISOString().slice(0, 10),
      },
      count: filteredDepartures.length,
      departures: filteredDepartures,
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
      select: { stationId: true, name: true },
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
          },
        },
      },
      take: 5000,
    });

    const departures = candidateStops
      .filter((stop) => {
        const runs = stop.schedule.scheduleDaysRuns ?? "";
        if (runs.length >= 7 && runs[dayIndex] !== "1") return false;
        return true;
      })
      .map((stop) => {
        const rawTime =
          stop.publicDeparture ??
          stop.departure ??
          stop.publicArrival ??
          stop.arrival ??
          stop.pass;

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
          _sortMinutes: depMinutes,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a._sortMinutes - b._sortMinutes)
      .slice(0, limit)
      .map(({ _sortMinutes, ...row }) => row);

    const windowEnd = new Date(from.getTime() + windowMinutes * 60 * 1000);

    return res.json({
      station,
      window: {
        from: from.toISOString(),
        to: windowEnd.toISOString(),
        windowMinutes,
        serviceDate: serviceDate.toISOString().slice(0, 10),
      },
      count: departures.length,
      departures,
    });
  });

  return app;
}
