import { PrismaClient } from "@prisma/client";
import { LiveMovementStore } from "../../infrastructure/liveData/LiveMovementStore";
import { getDayIndexMondayZero, getLocalDayRange, minutesToDate, parseRailTimeToMinutes, toNodeId } from "./helpers";
import { GraphSlice, JourneyNode, TransitEdge } from "./types";

function getStpPriority(stpIndicator: string | null): number {
  if (stpIndicator === "O") return 4;
  if (stpIndicator === "N") return 3;
  if (stpIndicator === "P") return 2;
  if (stpIndicator === "C") return 1;
  return 0;
}

export class RailRoutingAdapter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly liveMovementStore?: LiveMovementStore,
  ) {}

  async build(dateString: string): Promise<GraphSlice> {
    const { dayStart, nextDayStart } = getLocalDayRange(dateString);
    const dayIndex = getDayIndexMondayZero(dayStart);

    const schedules = await this.prisma.railServiceSchedule.findMany({
      where: {
        scheduleStartDate: { lte: nextDayStart },
        scheduleEndDate: { gte: dayStart },
      },
      select: {
        scheduleId: true,
        trainUid: true,
        stpIndicator: true,
        atocCode: true,
        scheduleDaysRuns: true,
        scheduleStartDate: true,
        updatedAt: true,
      },
    });

    const activeSchedules = schedules.filter((schedule) => {
      const runs = schedule.scheduleDaysRuns ?? "";
      return !(runs.length >= 7 && runs[dayIndex] !== "1");
    });

    const grouped = new Map<string, typeof activeSchedules>();
    for (const schedule of activeSchedules) {
      const list = grouped.get(schedule.trainUid) ?? [];
      list.push(schedule);
      grouped.set(schedule.trainUid, list);
    }

    const effectiveSchedules = Array.from(grouped.values())
      .map((group) => {
        const cancellation = group.find((item) => item.stpIndicator === "C");
        const chosen = [...group]
          .filter((item) => item.stpIndicator !== "C")
          .sort((left, right) => {
            const priorityDiff = getStpPriority(right.stpIndicator) - getStpPriority(left.stpIndicator);
            if (priorityDiff !== 0) return priorityDiff;
            const startDiff = right.scheduleStartDate.getTime() - left.scheduleStartDate.getTime();
            if (startDiff !== 0) return startDiff;
            return right.updatedAt.getTime() - left.updatedAt.getTime();
          })[0] ?? null;

        if (!chosen) return null;
        if (chosen.stpIndicator === "P" && cancellation) {
          return null;
        }
        return chosen;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const scheduleIds = effectiveSchedules.map((schedule) => schedule.scheduleId);

    const stops = scheduleIds.length === 0
      ? []
      : await this.prisma.railServiceStop.findMany({
          where: {
            scheduleId: { in: scheduleIds },
          },
          select: {
            scheduleId: true,
            stopSeq: true,
            stationId: true,
            publicArrival: true,
            publicDeparture: true,
            station: {
              select: {
                stationId: true,
                name: true,
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: [{ scheduleId: "asc" }, { stopSeq: "asc" }],
        });

    const stationById = new Map<string, JourneyNode>();
    const transitEdges: TransitEdge[] = [];
    let latestUpdatedAtMs: number | null = null;

    const scheduleById = new Map(effectiveSchedules.map((schedule) => [schedule.scheduleId, schedule]));
    const stopsBySchedule = new Map<string, typeof stops>();
    for (const stop of stops) {
      const list = stopsBySchedule.get(stop.scheduleId) ?? [];
      list.push(stop);
      stopsBySchedule.set(stop.scheduleId, list);
      if (stop.station && !stationById.has(stop.station.stationId)) {
        stationById.set(stop.station.stationId, {
          nodeId: toNodeId("station", stop.station.stationId),
          type: "station",
          id: stop.station.stationId,
          code: stop.station.stationId,
          name: stop.station.name,
          latitude: stop.station.latitude,
          longitude: stop.station.longitude,
        });
      }
    }

    // ── Live data: bulk-load stanox codes for all stations in the graph ──────
    const stanoxByStation = new Map<string, string>();
    if (this.liveMovementStore && this.liveMovementStore.size > 0 && stationById.size > 0) {
      const tiplocs = await this.prisma.railTiploc.findMany({
        where: { crsCode: { in: Array.from(stationById.keys()) } },
        select: { crsCode: true, stanox: true },
      });
      for (const tiploc of tiplocs) {
        if (tiploc.crsCode && tiploc.stanox && !stanoxByStation.has(tiploc.crsCode)) {
          stanoxByStation.set(tiploc.crsCode, tiploc.stanox);
        }
      }
    }

    for (const schedule of effectiveSchedules) {
      latestUpdatedAtMs = latestUpdatedAtMs === null ? schedule.updatedAt.getTime() : Math.max(latestUpdatedAtMs, schedule.updatedAt.getTime());
      const orderedStops = stopsBySchedule.get(schedule.scheduleId) ?? [];
      const publicStops = orderedStops.filter((stop) => stop.stationId && (stop.publicArrival || stop.publicDeparture));

      for (let index = 0; index < publicStops.length - 1; index += 1) {
        const current = publicStops[index];
        const next = publicStops[index + 1];
        if (!current.stationId || !next.stationId) continue;

        const departureMinutes = parseRailTimeToMinutes(current.publicDeparture ?? current.publicArrival);
        const arrivalMinutes = parseRailTimeToMinutes(next.publicArrival ?? next.publicDeparture);
        if (departureMinutes === null || arrivalMinutes === null) continue;

        let departureTimeMs = minutesToDate(dayStart, departureMinutes).getTime();
        let arrivalTimeMs = minutesToDate(dayStart, arrivalMinutes).getTime();
        if (arrivalTimeMs <= departureTimeMs) continue;

        // ── Apply live delay from STOMP movement store ────────────────────
        let liveDelayMinutes: number | null = null;
        if (this.liveMovementStore) {
          const stanox = stanoxByStation.get(current.stationId);
          if (stanox) {
            const live = this.liveMovementStore.findDeparture(stanox, departureMinutes);
            if (live?.timetableVariationMinutes) {
              liveDelayMinutes = live.timetableVariationMinutes;
              const delayMs = liveDelayMinutes * 60_000;
              departureTimeMs += delayMs;
              arrivalTimeMs += delayMs;
            }
          }
        }

        transitEdges.push({
          mode: "rail",
          fromNodeId: toNodeId("station", current.stationId),
          toNodeId: toNodeId("station", next.stationId),
          departureTimeMs,
          arrivalTimeMs,
          durationMinutes: Math.max(1, Math.ceil((arrivalTimeMs - departureTimeMs) / 60000)),
          serviceKey: `rail:${schedule.scheduleId}`,
          line: schedule.trainUid,
          operator: schedule.atocCode,
          routeId: null,
          scheduleId: schedule.scheduleId,
          liveDelayMinutes,
        });
      }
    }

    return {
      nodes: Array.from(stationById.values()),
      transitEdges,
      latestUpdatedAtMs,
    };
  }
}
