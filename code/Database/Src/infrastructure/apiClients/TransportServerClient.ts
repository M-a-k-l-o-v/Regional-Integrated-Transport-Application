import axios, { AxiosInstance } from "axios";
import { XMLParser } from "fast-xml-parser";
import type { TransportApiClient } from "../../domain/interfaces/TransportApiClient";

type RailBoardService = {
  std: string | null;
  etd: string | null;
  platform: string | null;
  operator: string | null;
  operatorCode: string | null;
  serviceType: string | null;
  serviceId: string | null;
  rsid: string | null;
  originName: string | null;
  destinationName: string | null;
};

export type WeatherSnapshot = {
  inBounds: boolean;
  locationName: string | null;
  description: string | null;
  icon: string | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  windSpeedMps: number | null;
  updatedAt: string | null;
};

export type RailBoardSnapshot = {
  generatedAt: string | null;
  locationName: string | null;
  crs: string | null;
  nrccMessages: string[];
  trainServices: RailBoardService[];
  busServices: RailBoardService[];
};

export type BusLiveVehicle = {
  recordedAtTime: string | null;
  lineRef: string | null;
  publishedLineName: string | null;
  operatorRef: string | null;
  directionRef: string | null;
  originName: string | null;
  destinationName: string | null;
  originAimedDepartureTime: string | null;
  monitored: boolean | null;
  vehicleRef: string | null;
  latitude: number | null;
  longitude: number | null;
  bearing: number | null;
  /** Delay in minutes derived from MonitoredCall aimed vs expected times, or null if unavailable. */
  monitoredCallDelayMinutes: number | null;
};

export type BusLiveSnapshot = {
  responseTimestamp: string | null;
  validUntil: string | null;
  vehicles: BusLiveVehicle[];
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Parse an ISO 8601 duration string (e.g. "PT5M", "PT-3M30S", "P0DT2M") into
 * a signed number of minutes. Returns null if the string is absent or zero.
 */
function parseSiriDuration(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const neg = value.startsWith("-") || value.includes("-");
  const clean = value.replace(/^-?P/i, "").replace(/^T/i, "");
  const hourMatch = clean.match(/(\d+)H/i);
  const minMatch = clean.match(/(-?\d+)M/i);
  const secMatch = clean.match(/(\d+)S/i);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const mins = minMatch ? Number(minMatch[1]) : 0;
  const secs = secMatch ? Number(secMatch[1]) : 0;
  const total = hours * 60 + mins + secs / 60;
  if (total === 0) return null;
  return neg ? -total : total;
}

/**
 * Compute delay in minutes between two ISO-8601 datetime strings.
 * Positive = late, negative = early. Returns null if either is absent/invalid.
 */
function parseSiriDelayBetween(aimed: unknown, expected: unknown): number | null {
  if (typeof aimed !== "string" || typeof expected !== "string") return null;
  const aimedMs = new Date(aimed).getTime();
  const expectedMs = new Date(expected).getTime();
  if (Number.isNaN(aimedMs) || Number.isNaN(expectedMs)) return null;
  const diffMs = expectedMs - aimedMs;
  const mins = Math.round(diffMs / 60000);
  return mins === 0 ? null : mins;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function normaliseRailBoardService(value: any): RailBoardService {
  return {
    std: asString(value?.std),
    etd: asString(value?.etd),
    platform: asString(value?.platform),
    operator: asString(value?.operator),
    operatorCode: asString(value?.operatorCode),
    serviceType: asString(value?.serviceType),
    serviceId: asString(value?.serviceID),
    rsid: asString(value?.rsid),
    originName: asString(value?.origin?.location?.locationName),
    destinationName: asString(value?.destination?.location?.locationName),
  };
}

export class TransportServerClient implements TransportApiClient {
  private readonly http: AxiosInstance;
  private readonly xmlParser: XMLParser;

  constructor(baseUrl: string, timeoutMs = 15_000) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ""),
      timeout: timeoutMs,
      maxRedirects: 5,
    });
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      removeNSPrefix: true,
      parseTagValue: false,
    });
  }

  async getWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
    const response = await this.http.get("/weather", {
      params: { lat, lon },
    });

    return {
      inBounds: response.data?.in_bounds === true,
      locationName: asString(response.data?.weather?.name),
      description: asString(response.data?.weather?.weather?.[0]?.description),
      icon: asString(response.data?.weather?.weather?.[0]?.icon),
      temperatureC: asNumber(response.data?.weather?.main?.temp),
      feelsLikeC: asNumber(response.data?.weather?.main?.feels_like),
      humidity: asNumber(response.data?.weather?.main?.humidity),
      windSpeedMps: asNumber(response.data?.weather?.wind?.speed),
      updatedAt:
        typeof response.data?.weather?.dt === "number"
          ? new Date(response.data.weather.dt * 1000).toISOString()
          : null,
    };
  }

  async getRailDepartures(crs: string): Promise<RailBoardSnapshot> {
    const response = await this.http.get(`/rail/departures/${encodeURIComponent(crs)}`, {
      responseType: "text",
    });
    const document = this.xmlParser.parse(response.data);
    const board = document?.StationBoardWithDetails ?? {};

    return {
      generatedAt: asString(board.generatedAt),
      locationName: asString(board.locationName),
      crs: asString(board.crs),
      nrccMessages: asArray(board.nrccMessages?.message).map((message) => String(message)).filter(Boolean),
      trainServices: asArray(board.trainServices?.service).map(normaliseRailBoardService),
      busServices: asArray(board.busServices?.service).map(normaliseRailBoardService),
    };
  }

  async getBusLive(operatorRef: string): Promise<BusLiveSnapshot> {
    const response = await this.http.get(`/bus/live/${encodeURIComponent(operatorRef)}`, {
      responseType: "text",
    });
    const document = this.xmlParser.parse(response.data);
    const delivery = document?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? {};

    return {
      responseTimestamp: asString(delivery.ResponseTimestamp),
      validUntil: asString(delivery.ValidUntil),
      vehicles: asArray(delivery.VehicleActivity).map((activity) => {
        const mvj = activity?.MonitoredVehicleJourney;
        const call = mvj?.MonitoredCall;
        const monitoredCallDelayMinutes =
          parseSiriDelayBetween(call?.AimedArrivalTime, call?.ExpectedArrivalTime) ??
          parseSiriDelayBetween(call?.AimedDepartureTime, call?.ExpectedDepartureTime) ??
          parseSiriDuration(call?.Delay);
        return {
          recordedAtTime: asString(activity?.RecordedAtTime),
          lineRef: asString(mvj?.LineRef),
          publishedLineName: asString(mvj?.PublishedLineName),
          operatorRef: asString(mvj?.OperatorRef),
          directionRef: asString(mvj?.DirectionRef),
          originName: asString(mvj?.OriginName),
          destinationName: asString(mvj?.DestinationName),
          originAimedDepartureTime: asString(mvj?.OriginAimedDepartureTime),
          monitored: asBoolean(mvj?.Monitored),
          vehicleRef: asString(mvj?.VehicleRef),
          latitude: asNumber(mvj?.VehicleLocation?.Latitude),
          longitude: asNumber(mvj?.VehicleLocation?.Longitude),
          bearing: asNumber(mvj?.Bearing),
          monitoredCallDelayMinutes,
        };
      }),
    };
  }
}
