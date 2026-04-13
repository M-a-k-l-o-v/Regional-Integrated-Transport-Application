import { JourneyPlanResponse } from "../lib/transportApi";

export type JourneyRoutePoint = {
  latitude: number;
  longitude: number;
};

export type JourneyRouteSegment = {
  mode: JourneyPlanResponse["itineraries"][number]["legs"][number]["mode"];
  points: JourneyRoutePoint[];
};

export type JourneyRouteShape = {
  segments: JourneyRouteSegment[];
  hasMappedPath: boolean;
};
