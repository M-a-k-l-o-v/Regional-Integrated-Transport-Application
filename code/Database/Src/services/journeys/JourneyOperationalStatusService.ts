import { PrismaClient } from "@prisma/client";
import { TransportServerClient, WeatherSnapshot } from "../../infrastructure/apiClients/TransportServerClient";
import { isInLancashire } from "../../infrastructure/geography";
import { getBusServiceLabel } from "./helpers";

type StatusPoint = {
  latitude: number | null;
  longitude: number | null;
};

type StatusResponse = {
  weather: {
    available: boolean;
    message: string;
    locationName: string | null;
    description: string | null;
    icon: string | null;
    temperatureC: number | null;
    feelsLikeC: number | null;
    humidity: number | null;
    windSpeedMps: number | null;
    updatedAt: string | null;
  };
  disruptions: {
    available: boolean;
    message: string | null;
    items: Array<{
      type: string;
      description: string;
      startTime: string | null;
      endTime: string | null;
      source?: string | null;
    }>;
  };
  reliability: {
    available: boolean;
    message: string | null;
    score: number | null;
    confidenceLevel: string | null;
    calculatedAt: string | null;
  };
  delays: {
    available: boolean;
    message: string | null;
    delayMinutes: number | null;
    cancellationFlag: boolean | null;
    lastUpdated: string | null;
    source: string | null;
    summary: string | null;
    liveDepartureTime: string | null;
    expectedDepartureTime: string | null;
    platform: string | null;
    monitoredVehicleCount: number | null;
    lineVehicleCount: number | null;
  };
};

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getRepresentativePoint(points: StatusPoint[]): { latitude: number; longitude: number } | null {
  const mapped = points.filter(
    (point): point is { latitude: number; longitude: number } => point.latitude !== null && point.longitude !== null
  );
  if (mapped.length === 0) return null;
  return mapped[Math.floor(mapped.length / 2)] ?? mapped[0] ?? null;
}

function buildWeatherMessage(snapshot: WeatherSnapshot | null): string {
  if (!snapshot || !snapshot.inBounds) {
    return "Weather lookup is unavailable for this area.";
  }

  const parts = [snapshot.description, snapshot.temperatureC !== null ? `${snapshot.temperatureC.toFixed(1)}°C` : null]
    .filter(Boolean)
    .join(" · ");
  const near = snapshot.locationName ? ` near ${snapshot.locationName}` : "";
  return parts.length > 0 ? `${parts}${near}` : `Current weather available${near}.`;
}

function computeDelayMinutes(std: string | null, live: string | null): number | null {
  if (!std || !live || !/^\d{2}:\d{2}$/.test(std) || !/^\d{2}:\d{2}$/.test(live)) return null;
  const [stdH, stdM] = std.split(":").map(Number);
  const [liveH, liveM] = live.split(":").map(Number);
  const stdMinutes = stdH * 60 + stdM;
  const liveMinutes = liveH * 60 + liveM;
  return Math.max(0, liveMinutes - stdMinutes);
}

function scoreRailBoardMatch(args: {
  scheduledDeparture: string | null;
  destinationDisplay: string | null;
  service: { std: string | null; destinationName: string | null };
}): number {
  let score = 0;
  if (args.scheduledDeparture && args.service.std === args.scheduledDeparture) score += 10;
  if (
    args.destinationDisplay &&
    args.service.destinationName &&
    args.service.destinationName.toLowerCase().includes(args.destinationDisplay.toLowerCase())
  ) {
    score += 6;
  }
  return score;
}

export class JourneyOperationalStatusService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly transportClient: TransportServerClient
  ) {}

  async getBusStatus(args: {
    routeId: string;
    operatorRef: string | null;
    lineRef: string | null;
    points: StatusPoint[];
  }): Promise<StatusResponse> {
    const [weather, reliability, storedDelay, disruptions, liveBus] = await Promise.all([
      this.loadWeather(args.points),
      this.prisma.reliabilityScore.findFirst({
        where: { routeId: args.routeId },
        orderBy: { calculatedAt: "desc" },
        select: { score: true, confidenceLevel: true, calculatedAt: true },
      }),
      this.prisma.serviceStatus.findFirst({
        where: { routeId: args.routeId },
        orderBy: { lastUpdated: "desc" },
        select: { delayMinutes: true, cancellationFlag: true, lastUpdated: true },
      }),
      this.prisma.disruption.findMany({
        where: { routeId: args.routeId },
        orderBy: { startTime: "desc" },
        take: 5,
        select: { type: true, description: true, startTime: true, endTime: true },
      }),
      args.operatorRef ? this.transportClient.getBusLive(args.operatorRef).catch(() => null) : Promise.resolve(null),
    ]);

    const lineLabel = getBusServiceLabel(args.lineRef, args.routeId);
    // Filter to Lancashire-area vehicles first, then match by line label.
    // The transport server returns out-of-area vehicles for any operatorRef query.
    const matchingVehicles = liveBus
      ? liveBus.vehicles.filter((vehicle) => {
          if (!isInLancashire(vehicle.latitude, vehicle.longitude)) return false;
          const liveLine = vehicle.publishedLineName ?? vehicle.lineRef;
          return liveLine === lineLabel;
        })
      : [];

    const monitoredVehicleCount = matchingVehicles.filter((vehicle) => vehicle.monitored === true).length;
    const mostRecentVehicleUpdate = matchingVehicles
      .map((vehicle) => vehicle.recordedAtTime)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    const liveDelaySummary = matchingVehicles.length > 0
      ? `${matchingVehicles.length} live vehicle update${matchingVehicles.length === 1 ? "" : "s"} currently reported for service ${lineLabel}.`
      : liveBus
        ? `No live vehicle positions are currently published for service ${lineLabel}.`
        : "Live bus positions are not available for this service right now.";

    return {
      weather: {
        available: weather !== null,
        message: buildWeatherMessage(weather),
        locationName: weather?.locationName ?? null,
        description: weather?.description ?? null,
        icon: weather?.icon ?? null,
        temperatureC: weather?.temperatureC ?? null,
        feelsLikeC: weather?.feelsLikeC ?? null,
        humidity: weather?.humidity ?? null,
        windSpeedMps: weather?.windSpeedMps ?? null,
        updatedAt: weather?.updatedAt ?? null,
      },
      disruptions: {
        available: disruptions.length > 0,
        message: disruptions.length > 0 ? null : "No disruption records have been ingested for this route yet.",
        items: disruptions.map((item) => ({
          type: item.type,
          description: item.description,
          startTime: toIso(item.startTime),
          endTime: toIso(item.endTime),
          source: "database",
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
        // Only mark as available when we actually have valid, in-area data.
        // A response from the SIRI endpoint with no matching Lancashire vehicles is not useful.
        available: storedDelay !== null || matchingVehicles.length > 0,
        message: storedDelay !== null || matchingVehicles.length > 0 ? null : "No live or historical delay status is available for this route yet.",
        delayMinutes: storedDelay?.delayMinutes ?? null,
        cancellationFlag: storedDelay?.cancellationFlag ?? null,
        lastUpdated: storedDelay?.lastUpdated ? toIso(storedDelay.lastUpdated) : mostRecentVehicleUpdate,
        source: storedDelay ? "database" : matchingVehicles.length > 0 ? "bus_live_positions" : null,
        summary: storedDelay
          ? `Stored route status reports ${storedDelay.delayMinutes} minute${storedDelay.delayMinutes === 1 ? "" : "s"} delay.`
          : liveDelaySummary,
        liveDepartureTime: null,
        expectedDepartureTime: null,
        platform: null,
        monitoredVehicleCount,
        lineVehicleCount: matchingVehicles.length,
      },
    };
  }

  async getRailStatus(args: {
    fromCrs: string | null;
    scheduledDeparture: string | null;
    destinationDisplay: string | null;
    points: StatusPoint[];
  }): Promise<StatusResponse> {
    const [weather, railBoard, reliability] = await Promise.all([
      this.loadWeather(args.points),
      args.fromCrs ? this.transportClient.getRailDepartures(args.fromCrs).catch(() => null) : Promise.resolve(null),
      this.prisma.reliabilityScore.findFirst({
        where: { routeId: "AI_STATS_AGG" },
        orderBy: { calculatedAt: "desc" },
        select: { score: true, confidenceLevel: true, calculatedAt: true },
      }),
    ]);

    const services = railBoard ? [...railBoard.trainServices, ...railBoard.busServices] : [];
    const matchedService = services
      .map((service) => ({
        service,
        score: scoreRailBoardMatch({
          scheduledDeparture: args.scheduledDeparture,
          destinationDisplay: args.destinationDisplay,
          service,
        }),
      }))
      .sort((left, right) => right.score - left.score)
      .find((entry) => entry.score > 0)?.service ?? null;

    const liveDelayMinutes = matchedService ? computeDelayMinutes(matchedService.std, matchedService.etd) : null;
    const liveSummary = matchedService
      ? `${matchedService.destinationName ?? "Service"} is currently ${matchedService.etd ?? "unavailable"}${matchedService.platform ? ` from platform ${matchedService.platform}` : ""}.`
      : railBoard
        ? `Live departures loaded for ${railBoard.locationName ?? args.fromCrs}, but no exact service match was found for this leg.`
        : "Live rail board data is unavailable right now.";

    const liveMessages = railBoard?.nrccMessages ?? [];

    return {
      weather: {
        available: weather !== null,
        message: buildWeatherMessage(weather),
        locationName: weather?.locationName ?? null,
        description: weather?.description ?? null,
        icon: weather?.icon ?? null,
        temperatureC: weather?.temperatureC ?? null,
        feelsLikeC: weather?.feelsLikeC ?? null,
        humidity: weather?.humidity ?? null,
        windSpeedMps: weather?.windSpeedMps ?? null,
        updatedAt: weather?.updatedAt ?? null,
      },
      disruptions: {
        available: liveMessages.length > 0,
        message: liveMessages.length > 0 ? null : "No live NRCC disruption notices were published for this station board.",
        items: liveMessages.map((message) => ({
          type: "NRCC notice",
          description: stripHtml(message),
          startTime: railBoard?.generatedAt ?? null,
          endTime: null,
          source: "rail_live_departures",
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
        available: railBoard !== null,
        message: railBoard ? null : "Live rail departure data is unavailable for this origin station.",
        delayMinutes: liveDelayMinutes,
        cancellationFlag: matchedService?.etd?.toLowerCase().includes("cancel") ?? false,
        lastUpdated: railBoard?.generatedAt ?? null,
        source: railBoard ? "rail_live_departures" : null,
        summary: liveSummary,
        liveDepartureTime: matchedService?.std ?? null,
        expectedDepartureTime: matchedService?.etd ?? null,
        platform: matchedService?.platform ?? null,
        monitoredVehicleCount: null,
        lineVehicleCount: null,
      },
    };
  }

  private async loadWeather(points: StatusPoint[]): Promise<WeatherSnapshot | null> {
    const representativePoint = getRepresentativePoint(points);
    if (!representativePoint) return null;
    return this.transportClient.getWeather(representativePoint.latitude, representativePoint.longitude).catch(() => null);
  }
}
