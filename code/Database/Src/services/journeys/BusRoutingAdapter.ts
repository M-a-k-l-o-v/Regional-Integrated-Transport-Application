import { BusJourneyTimingQuality, PrismaClient } from "@prisma/client";
import { GraphSlice, JourneyNode, TransitEdge } from "./types";
import { getBusServiceLabel, getLocalDayRange, toNodeId } from "./helpers";

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

export class BusRoutingAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async build(dateString: string): Promise<GraphSlice> {
    const { dayStart, nextDayStart } = getLocalDayRange(dateString);

    const journeys = await this.prisma.busJourney.findMany({
      where: {
        serviceDate: {
          gte: dayStart,
          lt: nextDayStart,
        },
        timingQuality: {
          in: [
            BusJourneyTimingQuality.EXACT,
            BusJourneyTimingQuality.REPAIRED,
            BusJourneyTimingQuality.ESTIMATED,
          ],
        },
        nonPositiveEdgeCount: 0,
      },
      select: {
        journeyId: true,
        routeId: true,
        lineRef: true,
        direction: true,
        destinationDisplay: true,
        updatedAt: true,
        route: {
          select: {
            operatorId: true,
            operator: {
              select: {
                name: true,
              },
            },
          },
        },
        stops: {
          select: {
            stopId: true,
            stopSeq: true,
            arrivalTime: true,
            departureTime: true,
          },
          orderBy: {
            stopSeq: "asc",
          },
        },
      },
    });

    const stopIds = new Set<string>();
    const transitEdges: TransitEdge[] = [];
    let latestUpdatedAtMs: number | null = null;

    for (const journey of journeys) {
      latestUpdatedAtMs = latestUpdatedAtMs === null ? journey.updatedAt.getTime() : Math.max(latestUpdatedAtMs, journey.updatedAt.getTime());
      const adjustedStopTimes = normaliseStopTimes(journey.stops);
      if (!adjustedStopTimes) continue;

      for (const stop of journey.stops) {
        stopIds.add(stop.stopId);
      }

      for (let index = 0; index < journey.stops.length - 1; index += 1) {
        const current = journey.stops[index];
        const next = journey.stops[index + 1];
        const departureTimeMs = adjustedStopTimes[index];
        const arrivalTimeMs = adjustedStopTimes[index + 1];
        if (arrivalTimeMs <= departureTimeMs) continue;

        transitEdges.push({
          mode: "bus",
          fromNodeId: toNodeId("bus_stop", current.stopId),
          toNodeId: toNodeId("bus_stop", next.stopId),
          departureTimeMs,
          arrivalTimeMs,
          durationMinutes: Math.max(1, Math.ceil((arrivalTimeMs - departureTimeMs) / 60000)),
          serviceKey: `bus:${journey.journeyId}`,
          line: getBusServiceLabel(journey.lineRef, journey.routeId),
          operator: journey.route.operator?.name ?? journey.route.operatorId ?? null,
          routeId: journey.routeId,
          scheduleId: journey.journeyId,
        });
      }
    }

    const stops = stopIds.size === 0
      ? []
      : await this.prisma.busStop.findMany({
          where: {
            stopId: {
              in: Array.from(stopIds),
            },
          },
          select: {
            stopId: true,
            name: true,
            latitude: true,
            longitude: true,
          },
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

    return {
      nodes,
      transitEdges,
      latestUpdatedAtMs,
    };
  }
}
