import { PrismaClient } from "@prisma/client";
import { formatBusStopGroupMemberName } from "../busStopGroups";
import { getBusServiceLabel } from "./helpers";

type JourneyLegDetailRequest = {
  mode: "bus" | "rail";
  scheduleId: string;
  fromId: string;
  toId: string;
};

type DetailLocation = {
  type: "station" | "bus_stop";
  id: string;
  code: string;
  name: string;
};

type DetailPoint = DetailLocation & {
  latitude: number | null;
  longitude: number | null;
  arrivalTime: string | null;
  departureTime: string | null;
  localityName?: string | null;
};

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function slicePath<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex >= 0 && toIndex >= fromIndex) {
    return items.slice(fromIndex, toIndex + 1);
  }
  return items;
}

export class JourneyLegDetailService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDetail(request: JourneyLegDetailRequest) {
    if (request.mode === "bus") {
      return this.getBusDetail(request);
    }

    return this.getRailDetail(request);
  }

  private async getBusDetail(request: JourneyLegDetailRequest) {
    const journey = await this.prisma.busJourney.findUnique({
      where: { journeyId: request.scheduleId },
      select: {
        journeyId: true,
        routeId: true,
        lineRef: true,
        direction: true,
        destinationDisplay: true,
        departureTime: true,
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
          orderBy: { stopSeq: "asc" },
          select: {
            stopId: true,
            arrivalTime: true,
            departureTime: true,
            busStop: {
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
            },
          },
        },
      },
    });

    if (!journey) {
      throw new Error(`Journey not found: ${request.scheduleId}`);
    }

    const fromIndex = journey.stops.findIndex((stop) => stop.stopId === request.fromId);
    const toIndex = journey.stops.findIndex((stop, index) => index >= Math.max(0, fromIndex) && stop.stopId === request.toId);
    const segment = slicePath(journey.stops, fromIndex, toIndex);
    const points: DetailPoint[] = segment.map((stop) => ({
      type: "bus_stop",
      id: stop.busStop.stopId,
      code: stop.busStop.stopId,
      name: formatBusStopGroupMemberName(stop.busStop.stopId, stop.busStop.name),
      latitude: stop.busStop.latitude,
      longitude: stop.busStop.longitude,
      arrivalTime: toIso(stop.arrivalTime),
      departureTime: toIso(stop.departureTime),
      localityName: stop.busStop.locality?.name ?? null,
    }));

    const fromPoint = points[0];
    const toPoint = points[points.length - 1];
    const routeStatus = await this.getRouteStatus(journey.routeId);

    return {
      dataState: {
        mode: "scheduled" as const,
        isLive: false,
        fallback: true,
        lastUpdated: toIso(journey.updatedAt),
      },
      leg: {
        mode: "bus" as const,
        scheduleId: journey.journeyId,
        routeId: journey.routeId,
        line: getBusServiceLabel(journey.lineRef, journey.routeId),
        operator: journey.route.operator?.name ?? journey.route.operatorId ?? null,
        direction: journey.direction,
        destinationDisplay: journey.destinationDisplay,
        from: fromPoint,
        to: toPoint,
        departureTime: fromPoint?.departureTime ?? toIso(journey.departureTime),
        arrivalTime: toPoint?.arrivalTime ?? null,
      },
      path: {
        pointCount: points.length,
        mappedPointCount: points.filter((point) => point.latitude !== null && point.longitude !== null).length,
        points,
      },
      status: routeStatus,
    };
  }

  private async getRailDetail(request: JourneyLegDetailRequest) {
    const schedule = await this.prisma.railServiceSchedule.findUnique({
      where: { scheduleId: request.scheduleId },
      select: {
        scheduleId: true,
        trainUid: true,
        atocCode: true,
        updatedAt: true,
        stops: {
          orderBy: { stopSeq: "asc" },
          select: {
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
        },
      },
    });

    if (!schedule) {
      throw new Error(`Rail schedule not found: ${request.scheduleId}`);
    }

    const publicStops = schedule.stops.filter((stop) => stop.stationId && stop.station);
    const fromIndex = publicStops.findIndex((stop) => stop.stationId === request.fromId);
    const toIndex = publicStops.findIndex((stop, index) => index >= Math.max(0, fromIndex) && stop.stationId === request.toId);
    const segment = slicePath(publicStops, fromIndex, toIndex);
    const points: DetailPoint[] = segment.map((stop) => ({
      type: "station",
      id: stop.stationId as string,
      code: stop.stationId as string,
      name: stop.station?.name ?? (stop.stationId as string),
      latitude: stop.station?.latitude ?? null,
      longitude: stop.station?.longitude ?? null,
      arrivalTime: stop.publicArrival ? stop.publicArrival : null,
      departureTime: stop.publicDeparture ? stop.publicDeparture : null,
    }));

    const fromPoint = points[0];
    const toPoint = points[points.length - 1];

    return {
      dataState: {
        mode: "scheduled" as const,
        isLive: false,
        fallback: true,
        lastUpdated: toIso(schedule.updatedAt),
      },
      leg: {
        mode: "rail" as const,
        scheduleId: schedule.scheduleId,
        routeId: null,
        line: schedule.trainUid,
        operator: schedule.atocCode ?? null,
        direction: null,
        destinationDisplay: toPoint?.name ?? null,
        from: fromPoint,
        to: toPoint,
        departureTime: fromPoint?.departureTime ?? null,
        arrivalTime: toPoint?.arrivalTime ?? null,
      },
      path: {
        pointCount: points.length,
        mappedPointCount: points.filter((point) => point.latitude !== null && point.longitude !== null).length,
        points,
      },
      status: this.buildUnavailableStatus("Route status datasets are not linked to rail schedules yet."),
    };
  }

  private async getRouteStatus(routeId: string | null) {
    if (!routeId) {
      return this.buildUnavailableStatus("Route-level status data is not available for this leg.");
    }

    const [reliability, delay, disruptions] = await Promise.all([
      this.prisma.reliabilityScore.findFirst({
        where: { routeId },
        orderBy: { calculatedAt: "desc" },
        select: {
          score: true,
          confidenceLevel: true,
          calculatedAt: true,
        },
      }),
      this.prisma.serviceStatus.findFirst({
        where: { routeId },
        orderBy: { lastUpdated: "desc" },
        select: {
          delayMinutes: true,
          cancellationFlag: true,
          lastUpdated: true,
        },
      }),
      this.prisma.disruption.findMany({
        where: {
          routeId,
        },
        orderBy: { startTime: "desc" },
        take: 5,
        select: {
          type: true,
          description: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);

    return {
      weather: {
        available: false,
        message: "Weather data has not been ingested yet for this area.",
      },
      disruptions: {
        available: disruptions.length > 0,
        message: disruptions.length > 0 ? null : "No disruption records have been ingested for this route yet.",
        items: disruptions.map((item) => ({
          type: item.type,
          description: item.description,
          startTime: toIso(item.startTime),
          endTime: toIso(item.endTime),
        })),
      },
      reliability: {
        available: reliability !== null,
        message: reliability ? null : "No reliability index has been calculated for this route yet.",
        score: reliability?.score ?? null,
        confidenceLevel: reliability?.confidenceLevel ?? null,
        calculatedAt: toIso(reliability?.calculatedAt),
      },
      delays: {
        available: delay !== null,
        message: delay ? null : "No live or historical delay status has been ingested for this route yet.",
        delayMinutes: delay?.delayMinutes ?? null,
        cancellationFlag: delay?.cancellationFlag ?? null,
        lastUpdated: toIso(delay?.lastUpdated),
      },
    };
  }

  private buildUnavailableStatus(message: string) {
    return {
      weather: {
        available: false,
        message: "Weather data has not been ingested yet for this area.",
      },
      disruptions: {
        available: false,
        message,
        items: [] as Array<{
          type: string;
          description: string;
          startTime: string | null;
          endTime: string | null;
        }>,
      },
      reliability: {
        available: false,
        message,
        score: null as number | null,
        confidenceLevel: null as string | null,
        calculatedAt: null as string | null,
      },
      delays: {
        available: false,
        message,
        delayMinutes: null as number | null,
        cancellationFlag: null as boolean | null,
        lastUpdated: null as string | null,
      },
    };
  }
}
