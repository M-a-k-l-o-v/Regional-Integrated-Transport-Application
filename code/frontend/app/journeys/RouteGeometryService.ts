import "server-only";

import { JourneyRoutePoint, JourneyRouteSegment, JourneyRouteShape } from "./types";

type RoutingProfile = "driving" | "foot";

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const MAX_BUS_ROUTE_POINTS = 24;
const REQUEST_TIMEOUT_MS = 4000;

function buildPointKey(point: JourneyRoutePoint): string {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

function dedupeSequentialPoints(points: JourneyRoutePoint[]): JourneyRoutePoint[] {
  return points.filter((point, index, values) => index === 0 || buildPointKey(point) !== buildPointKey(values[index - 1]));
}

function samplePoints(points: JourneyRoutePoint[], maxPoints: number): JourneyRoutePoint[] {
  if (points.length <= maxPoints) return points;

  const sampled: JourneyRoutePoint[] = [points[0]];
  const middleCount = maxPoints - 2;
  const step = (points.length - 2) / middleCount;

  for (let index = 1; index <= middleCount; index += 1) {
    const pointIndex = Math.min(points.length - 2, Math.max(1, Math.round(index * step)));
    sampled.push(points[pointIndex]);
  }

  sampled.push(points[points.length - 1]);
  return dedupeSequentialPoints(sampled);
}

class RouteGeometryService {
  private readonly cache = new Map<string, JourneyRoutePoint[] | null>();
  private readonly osrmBaseUrl = process.env.OSRM_BASE_URL ?? DEFAULT_OSRM_BASE_URL;

  async refineShapes(routeShapes: JourneyRouteShape[]): Promise<JourneyRouteShape[]> {
    const refined = await Promise.all(
      routeShapes.map(async (shape) => {
        const segments = await Promise.all(shape.segments.map((segment) => this.refineSegment(segment)));
        return {
          segments,
          hasMappedPath: segments.some((segment) => segment.points.length >= 2),
        };
      })
    );

    return refined;
  }

  async refinePath(mode: JourneyRouteSegment["mode"], points: JourneyRoutePoint[]): Promise<JourneyRoutePoint[]> {
    const segment = await this.refineSegment({ mode, points });
    return segment.points;
  }

  private async refineSegment(segment: JourneyRouteSegment): Promise<JourneyRouteSegment> {
    if (segment.points.length < 2) return segment;
    if (segment.mode === "rail") return segment;

    if (segment.mode === "walk") {
      const first = segment.points[0];
      const last = segment.points[segment.points.length - 1];
      const routedPoints = await this.fetchProfileRoute("foot", [first, last]);
      return routedPoints && routedPoints.length >= 2 ? { ...segment, points: routedPoints } : segment;
    }

    const busPoints = samplePoints(dedupeSequentialPoints(segment.points), MAX_BUS_ROUTE_POINTS);
    const routedPoints = await this.fetchProfileRoute("driving", busPoints);
    return routedPoints && routedPoints.length >= 2 ? { ...segment, points: routedPoints } : segment;
  }

  private async fetchProfileRoute(profile: RoutingProfile, points: JourneyRoutePoint[]): Promise<JourneyRoutePoint[] | null> {
    const normalisedPoints = dedupeSequentialPoints(points);
    if (normalisedPoints.length < 2) return null;

    const cacheKey = `${profile}:${normalisedPoints.map(buildPointKey).join("|")}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    const coordinates = normalisedPoints.map((point) => `${point.longitude},${point.latitude}`).join(";");
    const url = `${this.osrmBaseUrl}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=false&continue_straight=true`;

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const payload = (await response.json()) as {
        routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      };
      const coordinates = payload.routes?.[0]?.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) {
        this.cache.set(cacheKey, null);
        return null;
      }

      const mappedPoints = coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
      this.cache.set(cacheKey, mappedPoints);
      return mappedPoints;
    } catch {
      this.cache.set(cacheKey, null);
      return null;
    }
  }
}

export const routeGeometryService = new RouteGeometryService();
