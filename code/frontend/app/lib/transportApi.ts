const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const DEFAULT_BUS_DATE = "2026-05-04";
export const DEFAULT_TRAIN_FROM = "2026-05-04T04:00";
export const DEFAULT_PLANNER_DATE = "2026-05-04";
export const DEFAULT_PLANNER_TIME = "08:00";

export type BoardMode = "bus" | "rail";

export type SearchResult = {
  type: "bus_stop" | "bus_stop_group" | "station";
  id: string;
  code: string;
  name: string;
  localityId: string | null;
  localityName: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PlannerLocation = {
  type: "bus_stop" | "bus_stop_group" | "station";
  id: string;
  code: string;
  name: string;
  localityName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const DEFAULT_BUS_BOARD_LOCATIONS: PlannerLocation[] = [
  { type: "bus_stop_group", id: "lancaster_bus_station", code: "lancaster_bus_station", name: "Lancaster Bus Station", localityName: "Lancaster City Centre" },
  { type: "bus_stop_group", id: "preston_bus_station", code: "preston_bus_station", name: "Preston Bus Station", localityName: "Preston City Centre" },
  { type: "bus_stop_group", id: "morecambe_bus_station", code: "morecambe_bus_station", name: "Morecambe Bus Station", localityName: "Morecambe" },
  { type: "bus_stop_group", id: "chorley_bus_station", code: "chorley_bus_station", name: "Chorley Bus Station", localityName: "Chorley Town Centre" },
  { type: "bus_stop", id: "250020093", code: "250020093", name: "Common Garden Street", localityName: "Lancaster City Centre" },
  { type: "bus_stop", id: "2500918", code: "2500918", name: "Underpass", localityName: "Lancaster University" },
  { type: "bus_stop", id: "2500LAA16374", code: "2500LAA16374", name: "Sports Centre", localityName: "Lancaster University" },
  { type: "bus_stop", id: "2500LA00225", code: "2500LA00225", name: "Skerton Bridge", localityName: "Lancaster City Centre" },
  { type: "bus_stop", id: "2500906", code: "2500906", name: "Sainsbury's Layby", localityName: "Lancaster City Centre" },
  { type: "bus_stop", id: "2500LAA07323", code: "2500LAA07323", name: "Percy Street", localityName: "Preston City Centre" },
  { type: "bus_stop", id: "2500DCL3255", code: "2500DCL3255", name: "Ring Way", localityName: "Preston City Centre" },
  { type: "bus_stop", id: "25001184", code: "25001184", name: "Railway Station", localityName: "Preston City Centre" },
  { type: "bus_stop", id: "2500DCL3206", code: "2500DCL3206", name: "Railway Station", localityName: "Preston City Centre" },
  { type: "bus_stop", id: "2500IMG1300", code: "2500IMG1300", name: "West Cliff", localityName: "Broadgate" },
  { type: "bus_stop", id: "2500JB4", code: "2500JB4", name: "Fishergate Hill Surgery", localityName: "Broadgate" },
  { type: "bus_stop", id: "2500IMG1316", code: "2500IMG1316", name: "Queen Street", localityName: "Frenchwood" },
  { type: "bus_stop", id: "25001140", code: "25001140", name: "Tesco", localityName: "Penwortham" },
  { type: "bus_stop", id: "250020031", code: "250020031", name: "Red Cross", localityName: "Skerton" },
  { type: "bus_stop", id: "2500DCL3001", code: "2500DCL3001", name: "Health Innovation Campus", localityName: "Bailrigg" },
  { type: "bus_stop", id: "250012170", code: "250012170", name: "Boot and Shoe", localityName: "Scotforth" },
];

export const DEFAULT_RAIL_BOARD_LOCATIONS: PlannerLocation[] = [
  { type: "station", id: "LAN", code: "LAN", name: "Lancaster", localityName: null },
  { type: "station", id: "MCM", code: "MCM", name: "Morecambe", localityName: null },
  { type: "station", id: "PRE", code: "PRE", name: "Preston", localityName: null },
  { type: "station", id: "LEY", code: "LEY", name: "Leyland", localityName: null },
  { type: "station", id: "BSV", code: "BSV", name: "Buckshaw Parkway", localityName: null },
  { type: "station", id: "CRL", code: "CRL", name: "Chorley", localityName: null },
  { type: "station", id: "BBN", code: "BBN", name: "Blackburn", localityName: null },
  { type: "station", id: "ACR", code: "ACR", name: "Accrington", localityName: null },
  { type: "station", id: "CLH", code: "CLH", name: "Clitheroe", localityName: null },
  { type: "station", id: "BYM", code: "BYM", name: "Burnley Manchester Road", localityName: null },
  { type: "station", id: "BNC", code: "BNC", name: "Burnley Central", localityName: null },
  { type: "station", id: "BUB", code: "BUB", name: "Burnley Barracks", localityName: null },
  { type: "station", id: "NEL", code: "NEL", name: "Nelson", localityName: null },
  { type: "station", id: "CNE", code: "CNE", name: "Colne", localityName: null },
  { type: "station", id: "DWN", code: "DWN", name: "Darwen", localityName: null },
  { type: "station", id: "RSG", code: "RSG", name: "Rose Grove", localityName: null },
  { type: "station", id: "PFY", code: "PFY", name: "Poulton-le-Fylde", localityName: null },
  { type: "station", id: "KKM", code: "KKM", name: "Kirkham & Wesham", localityName: null },
  { type: "station", id: "BPN", code: "BPN", name: "Blackpool North", localityName: null },
  { type: "station", id: "BPS", code: "BPS", name: "Blackpool South", localityName: null },
];

export type JourneyPreference = "fastest" | "balanced" | "fewest_changes";

export type SearchResponse = {
  query: string;
  count: number;
  results: SearchResult[];
};

export type RecentBoardEntry = {
  mode: BoardMode;
  location: PlannerLocation;
  href: string;
  viewedAt: string;
};

export type HealthResponse = {
  ok: boolean;
};

export type DataState = {
  mode: "scheduled";
  isLive: false;
  fallback: true;
  lastUpdated: string | null;
};

export type BusDeparturesResponse = {
  scope: {
    type: "bus_stop" | "bus_stop_group";
    id: string;
    code: string;
    name: string;
    localityName: string | null;
    memberStopIds?: string[];
  };
  dataState: DataState;
  window: {
    from: string;
    to: string;
    windowMinutes: number;
    serviceDate: string;
  };
  count: number;
  departures: Array<{
    scheduleId: string;
    stopId: string;
    stopName: string;
    routeId: string;
    operator: { operatorId: string; name: string | null } | null;
    departureTime: string;
    arrivalTime: string;
    lineRef: string | null;
    direction: string | null;
    destinationDisplay: string | null;
    minutesUntilDeparture: number;
  }>;
};

export type RailDeparturesResponse = {
  station: {
    stationId: string;
    name: string;
  };
  dataState: DataState;
  window: {
    from: string;
    to: string;
    windowMinutes: number;
    serviceDate: string;
  };
  count: number;
  departures: Array<{
    stopId: string;
    scheduleId: string;
    trainUid: string;
    stpIndicator: string;
    operatorCode: string | null;
    status: string | null;
    locationType: string;
    platform: string | null;
    scheduledDepartureRaw: string | null;
    scheduledDeparture: string | null;
    destination: string | null;
    minutesUntilDeparture: number;
    source: "timetable";
    isLive: false;
  }>;
};

export type BusRouteCalendarResponse = {
  routeId: string;
  date: string;
  runsOnDate: boolean;
  dataState: DataState;
  calendar: {
    routeId: string;
    serviceCode: string;
    validFrom: string | null;
    validTo: string | null;
    runsMon: boolean;
    runsTue: boolean;
    runsWed: boolean;
    runsThu: boolean;
    runsFri: boolean;
    runsSat: boolean;
    runsSun: boolean;
    sourceFile: string;
    updatedAt: string;
  };
  exceptions: Array<{
    startDate: string;
    endDate: string;
    isRunning: boolean;
    reason: string | null;
    sourceFile: string;
  }>;
};

export type JourneyPlanResponse = {
  dataState: DataState;
  query: {
    origin: PlannerLocation;
    destination: PlannerLocation;
    date: string;
    time: string;
    preference: JourneyPreference;
  };
  itineraries: Array<{
    departureTime: string;
    arrivalTime: string;
    totalMinutes: number;
    transfers: number;
    walkingMinutes: number;
    legs: Array<{
      mode: "walk" | "bus" | "rail";
      from: PlannerLocation;
      to: PlannerLocation;
      departureTime: string | null;
      arrivalTime: string | null;
      line: string | null;
      operator: string | null;
      routeId: string | null;
      scheduleId: string | null;
      isScheduled: true;
    }>;
  }>;
};

export type JourneyLegDetailResponse = {
  dataState: DataState;
  leg: {
    mode: "bus" | "rail";
    scheduleId: string;
    routeId: string | null;
    line: string | null;
    operator: string | null;
    direction: string | null;
    destinationDisplay: string | null;
    from: PlannerLocation;
    to: PlannerLocation;
    departureTime: string | null;
    arrivalTime: string | null;
  };
  path: {
    pointCount: number;
    mappedPointCount: number;
    points: Array<
      PlannerLocation & {
        latitude: number | null;
        longitude: number | null;
        arrivalTime: string | null;
        departureTime: string | null;
        localityName?: string | null;
      }
    >;
  };
  status: {
    weather: {
      available: boolean;
      message: string;
    };
    disruptions: {
      available: boolean;
      message: string | null;
      items: Array<{
        type: string;
        description: string;
        startTime: string | null;
        endTime: string | null;
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
    };
  };
};

type ApiResult<T> = {
  data: T | null;
  error: string | null;
};

async function parseApiResponse<T>(response: Response): Promise<ApiResult<T>> {
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") {
        message = body.error;
      }
    } catch {
      // ignore json parse failure
    }
    return { data: null, error: message };
  }

  return {
    data: (await response.json()) as T,
    error: null,
  };
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getRouteCode(routeId: string): string {
  return routeId.split(":").pop() ?? routeId;
}

export function buildBoardHref(location: PlannerLocation, query?: string): string {
  const suffix = query && query.length > 0 ? `&q=${encodeURIComponent(query)}` : "";
  if (location.type === "station") {
    return `/location-info/train?crs=${encodeURIComponent(location.code)}&from=${encodeURIComponent(DEFAULT_TRAIN_FROM)}${suffix}`;
  }
  if (location.type === "bus_stop_group") {
    const params = new URLSearchParams();
    params.set("groupId", location.id);
    params.set("date", DEFAULT_BUS_DATE);
    if (location.name) params.set("groupName", location.name);
    if (location.localityName) params.set("stopLocalityName", location.localityName);
    if (query && query.length > 0) params.set("q", query);
    return `/location-info/bus?${params.toString()}`;
  }
  return `/location-info/bus?stopId=${encodeURIComponent(location.code)}&date=${DEFAULT_BUS_DATE}${suffix}`;
}

export function searchResultToPlannerLocation(result: SearchResult): PlannerLocation {
  return {
    type: result.type,
    id: result.id,
    code: result.code,
    name: result.name,
    localityName: result.localityName,
  };
}

export function filterSearchResultsForBoardMode(results: SearchResult[], mode: BoardMode): PlannerLocation[] {
  return results
    .filter((result) => (mode === "rail" ? result.type === "station" : result.type === "bus_stop" || result.type === "bus_stop_group"))
    .map(searchResultToPlannerLocation);
}

export function buildJourneyLegHref(leg: JourneyPlanResponse["itineraries"][number]["legs"][number]): string {
  const params = new URLSearchParams();
  params.set("mode", leg.mode);
  if (leg.scheduleId) params.set("scheduleId", leg.scheduleId);
  params.set("fromId", leg.from.id);
  params.set("toId", leg.to.id);
  if (leg.line) params.set("line", leg.line);
  if (leg.operator) params.set("operator", leg.operator);
  if (leg.routeId) params.set("routeId", leg.routeId);
  params.set("fromName", leg.from.name);
  params.set("toName", leg.to.name);
  return `/journeys/leg?${params.toString()}`;
}

export function buildJourneyLegDetailPath(leg: JourneyPlanResponse["itineraries"][number]["legs"][number]): string | null {
  if (leg.mode === "walk" || !leg.scheduleId) return null;
  const params = new URLSearchParams();
  params.set("mode", leg.mode);
  params.set("scheduleId", leg.scheduleId);
  params.set("fromId", leg.from.id);
  params.set("toId", leg.to.id);
  return `/journeys/legs/detail?${params.toString()}`;
}

export function formatPlannerLocationLabel(location: PlannerLocation | null): string {
  if (!location) return "";
  const locality = location.localityName?.trim();
  const label = locality ? `${location.name}, ${locality}` : location.name;
  if (location.type === "bus_stop_group") return label;
  return `${label} (${location.code})`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}

export function formatShortTime(value: string | null): string {
  if (!value) return "Unknown";
  const hhmm = value.match(/^(\d{2}):(\d{2})$/) ?? value.match(/^(\d{2})(\d{2})$/);
  if (hhmm) {
    return `${hhmm[1]}:${hhmm[2]}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatDurationMinutes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Unknown";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export async function fetchJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
    });

    return parseApiResponse<T>(response);
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return parseApiResponse<T>(response);
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}
