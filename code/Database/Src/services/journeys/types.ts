export type PlannerLocationType = "station" | "bus_stop" | "bus_stop_group";
export type JourneyPreference = "fastest" | "balanced" | "fewest_changes";
export type TransitMode = "bus" | "rail";

export type AccessCandidate = {
  nodeId: string;
  durationMinutes: number;
};

export type PlannerLocationRef = {
  type: PlannerLocationType;
  id: string;
};

export type JourneyPlanRequest = {
  origin: PlannerLocationRef;
  destination: PlannerLocationRef;
  date: string;
  time: string;
  preference: JourneyPreference;
  maxItineraries: number;
  modes?: TransitMode[];
};

export type JourneyNode = {
  nodeId: string;
  type: PlannerLocationType;
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export type TransitEdge = {
  mode: "walk" | "bus" | "rail";
  fromNodeId: string;
  toNodeId: string;
  departureTimeMs: number | null;
  arrivalTimeMs: number;
  durationMinutes: number;
  serviceKey: string | null;
  line: string | null;
  operator: string | null;
  routeId: string | null;
  scheduleId: string | null;
  /** Set when live delay data was applied. Positive = late, negative = early. */
  liveDelayMinutes?: number | null;
  /** True when the route's XML declares a bank holiday non-operation for this date,
   *  but we still show it because operators often run amended timetables anyway. */
  bankHolidayAdvisory?: boolean;
};

export type TakenEdge = TransitEdge & {
  actualDepartureTimeMs: number | null;
  actualArrivalTimeMs: number;
};

export type GraphSlice = {
  nodes: JourneyNode[];
  transitEdges: TransitEdge[];
  latestUpdatedAtMs: number | null;
};

export type TransitGraph = {
  nodes: Map<string, JourneyNode>;
  transitOutgoing: Map<string, TransitEdge[]>;
  walkingOutgoing: Map<string, TransitEdge[]>;
  latestUpdatedAtMs: number | null;
};

export type SearchLabel = {
  nodeId: string;
  timeMs: number;
  transfers: number;
  walkingMinutes: number;
  lastServiceKey: string | null;
  hasBoardedTransit: boolean;
  edges: TakenEdge[];
};

export type JourneyLegResponse = {
  mode: "walk" | "bus" | "rail";
  from: {
    type: PlannerLocationType;
    id: string;
    code: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
  to: {
    type: PlannerLocationType;
    id: string;
    code: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
  departureTime: string | null;
  arrivalTime: string | null;
  /** Original scheduled departure before live delay was applied. Null when no live data. */
  scheduledDepartureTime: string | null;
  /** Positive = late, negative = early, null = no live data. */
  liveDelayMinutes: number | null;
  line: string | null;
  operator: string | null;
  routeId: string | null;
  scheduleId: string | null;
  isScheduled: true;
  /** True when service may be affected by bank holiday timetable changes. */
  bankHolidayAdvisory?: boolean;
};

export type JourneyItineraryResponse = {
  departureTime: string;
  arrivalTime: string;
  totalMinutes: number;
  transfers: number;
  walkingMinutes: number;
  legs: JourneyLegResponse[];
};

export type JourneyPlanResponse = {
  dataState: {
    mode: "scheduled" | "live";
    isLive: boolean;
    fallback: boolean;
    lastUpdated: string | null;
  };
  query: {
    origin: {
      type: PlannerLocationType;
      id: string;
      code: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    };
    destination: {
      type: PlannerLocationType;
      id: string;
      code: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
    };
    date: string;
    time: string;
    preference: JourneyPreference;
  };
  itineraries: JourneyItineraryResponse[];
};
