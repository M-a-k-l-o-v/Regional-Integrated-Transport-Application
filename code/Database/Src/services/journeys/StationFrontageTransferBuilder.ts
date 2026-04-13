import { PrismaClient } from "@prisma/client";
import { JourneyNode, TransitEdge } from "./types";
import { extractStationTokens, FRONTAGE_EXCLUDED_TERMS, FRONTAGE_TERMS, matchesStationFrontageStop } from "../stations/stationFrontageMatching";

const DEFAULT_WALK_MINUTES = 4;

type FrontageStop = {
  stopId: string;
  name: string;
  localityName: string | null;
};

export class StationFrontageTransferBuilder {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly walkMinutes: number = DEFAULT_WALK_MINUTES
  ) {}

  async build(nodes: JourneyNode[]): Promise<TransitEdge[]> {
    const stationNodes = nodes.filter((node) => node.type === "station");
    const busStopNodeIds = new Set(
      nodes.filter((node) => node.type === "bus_stop").map((node) => node.id)
    );

    if (stationNodes.length === 0 || busStopNodeIds.size === 0) {
      return [];
    }

    const frontageStops = await this.prisma.busStop.findMany({
      where: {
        OR: FRONTAGE_TERMS.map((term) => ({
          name: { contains: term, mode: "insensitive" as const },
        })),
      },
      select: {
        stopId: true,
        name: true,
        locality: {
          select: {
            name: true,
          },
        },
      },
    });

    const usableFrontageStops: FrontageStop[] = frontageStops
      .filter((stop) => {
        if (!busStopNodeIds.has(stop.stopId)) return false;
        const lower = stop.name.toLowerCase();
        return !FRONTAGE_EXCLUDED_TERMS.some((term) => lower.includes(term));
      })
      .map((stop) => ({
        stopId: stop.stopId,
        name: stop.name,
        localityName: stop.locality?.name ?? null,
      }));

    const edges: TransitEdge[] = [];
    const seen = new Set<string>();

    for (const station of stationNodes) {
      const tokens = this.extractTokens(station.name);
      if (tokens.length === 0) continue;

      for (const stop of usableFrontageStops) {
        if (!this.matches(tokens, stop)) continue;

        const forwardKey = `station:${station.id}->bus:${stop.stopId}`;
        const reverseKey = `bus:${stop.stopId}->station:${station.id}`;
        if (!seen.has(forwardKey)) {
          seen.add(forwardKey);
          edges.push(this.buildWalkEdge(station.nodeId, `bus_stop:${stop.stopId}`));
        }
        if (!seen.has(reverseKey)) {
          seen.add(reverseKey);
          edges.push(this.buildWalkEdge(`bus_stop:${stop.stopId}`, station.nodeId));
        }
      }
    }

    return edges;
  }

  private buildWalkEdge(fromNodeId: string, toNodeId: string): TransitEdge {
    return {
      mode: "walk",
      fromNodeId,
      toNodeId,
      departureTimeMs: null,
      arrivalTimeMs: this.walkMinutes * 60 * 1000,
      durationMinutes: this.walkMinutes,
      serviceKey: null,
      line: null,
      operator: null,
      routeId: null,
      scheduleId: null,
    };
  }

  private extractTokens(name: string): string[] {
    return extractStationTokens(name);
  }

  private matches(tokens: string[], stop: FrontageStop): boolean {
    return matchesStationFrontageStop(tokens, stop.name, stop.localityName);
  }
}
