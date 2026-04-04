import { haversineDistanceMetres } from "./helpers";
import { JourneyNode, TransitEdge } from "./types";

const DEFAULT_RADIUS_METRES = 500;
const DEFAULT_WALK_SPEED_METRES_PER_SECOND = 1.3;
const DEGREE_BUCKET = 0.006;

export class WalkingTransferBuilder {
  constructor(
    private readonly radiusMetres: number = DEFAULT_RADIUS_METRES,
    private readonly walkSpeedMetresPerSecond: number = DEFAULT_WALK_SPEED_METRES_PER_SECOND
  ) {}

  build(nodes: JourneyNode[]): TransitEdge[] {
    const candidates = nodes.filter((node) => node.latitude !== null && node.longitude !== null);
    const buckets = new Map<string, JourneyNode[]>();

    for (const node of candidates) {
      const bucketKey = this.getBucketKey(node.latitude as number, node.longitude as number);
      const list = buckets.get(bucketKey) ?? [];
      list.push(node);
      buckets.set(bucketKey, list);
    }

    const edges: TransitEdge[] = [];

    for (const node of candidates) {
      const neighbours = this.getNeighbouringNodes(node, buckets);
      for (const neighbour of neighbours) {
        if (node.nodeId >= neighbour.nodeId) continue;
        const distance = haversineDistanceMetres(
          node.latitude as number,
          node.longitude as number,
          neighbour.latitude as number,
          neighbour.longitude as number
        );
        if (distance === 0 || distance > this.radiusMetres) continue;

        const durationMinutes = Math.max(1, Math.ceil(distance / this.walkSpeedMetresPerSecond / 60));
        edges.push(this.buildEdge(node.nodeId, neighbour.nodeId, durationMinutes));
        edges.push(this.buildEdge(neighbour.nodeId, node.nodeId, durationMinutes));
      }
    }

    return edges;
  }

  private buildEdge(fromNodeId: string, toNodeId: string, durationMinutes: number): TransitEdge {
    return {
      mode: "walk",
      fromNodeId,
      toNodeId,
      departureTimeMs: null,
      arrivalTimeMs: durationMinutes * 60 * 1000,
      durationMinutes,
      serviceKey: null,
      line: null,
      operator: null,
      routeId: null,
      scheduleId: null,
    };
  }

  private getBucketKey(latitude: number, longitude: number): string {
    return `${Math.floor(latitude / DEGREE_BUCKET)}:${Math.floor(longitude / DEGREE_BUCKET)}`;
  }

  private getNeighbouringNodes(node: JourneyNode, buckets: Map<string, JourneyNode[]>): JourneyNode[] {
    const latitude = node.latitude as number;
    const longitude = node.longitude as number;
    const baseLat = Math.floor(latitude / DEGREE_BUCKET);
    const baseLon = Math.floor(longitude / DEGREE_BUCKET);
    const neighbours: JourneyNode[] = [];

    for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
      for (let lonOffset = -1; lonOffset <= 1; lonOffset += 1) {
        const bucket = buckets.get(`${baseLat + latOffset}:${baseLon + lonOffset}`);
        if (bucket) {
          neighbours.push(...bucket);
        }
      }
    }

    return neighbours;
  }
}
