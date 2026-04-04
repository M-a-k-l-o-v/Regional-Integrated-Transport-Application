import { PrismaClient } from "@prisma/client";
import { BusRoutingAdapter } from "./BusRoutingAdapter";
import { RailRoutingAdapter } from "./RailRoutingAdapter";
import { StationFrontageTransferBuilder } from "./StationFrontageTransferBuilder";
import { WalkingTransferBuilder } from "./WalkingTransferBuilder";
import { TransitEdge, TransitGraph } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedGraph = {
  builtAtMs: number;
  graph: TransitGraph;
};

export class TransitGraphBuilder {
  private readonly cache = new Map<string, CachedGraph>();
  private readonly busAdapter: BusRoutingAdapter;
  private readonly railAdapter: RailRoutingAdapter;
  private readonly walkingTransferBuilder: WalkingTransferBuilder;
  private readonly stationFrontageTransferBuilder: StationFrontageTransferBuilder;

  constructor(prisma: PrismaClient) {
    this.busAdapter = new BusRoutingAdapter(prisma);
    this.railAdapter = new RailRoutingAdapter(prisma);
    this.walkingTransferBuilder = new WalkingTransferBuilder();
    this.stationFrontageTransferBuilder = new StationFrontageTransferBuilder(prisma);
  }

  async build(dateString: string): Promise<TransitGraph> {
    const cached = this.cache.get(dateString);
    if (cached && Date.now() - cached.builtAtMs < CACHE_TTL_MS) {
      return cached.graph;
    }

    const [busSlice, railSlice] = await Promise.all([
      this.busAdapter.build(dateString),
      this.railAdapter.build(dateString),
    ]);

    const nodes = new Map([...busSlice.nodes, ...railSlice.nodes].map((node) => [node.nodeId, node]));
    const transitOutgoing = new Map<string, TransitEdge[]>();
    const walkingOutgoing = new Map<string, TransitEdge[]>();

    for (const edge of [...busSlice.transitEdges, ...railSlice.transitEdges]) {
      const list = transitOutgoing.get(edge.fromNodeId) ?? [];
      list.push(edge);
      transitOutgoing.set(edge.fromNodeId, list);
    }

    for (const edges of transitOutgoing.values()) {
      edges.sort((left, right) => (left.departureTimeMs ?? 0) - (right.departureTimeMs ?? 0));
    }

    for (const edge of this.walkingTransferBuilder.build(Array.from(nodes.values()))) {
      const list = walkingOutgoing.get(edge.fromNodeId) ?? [];
      list.push(edge);
      walkingOutgoing.set(edge.fromNodeId, list);
    }

    for (const edge of await this.stationFrontageTransferBuilder.build(Array.from(nodes.values()))) {
      const list = walkingOutgoing.get(edge.fromNodeId) ?? [];
      list.push(edge);
      walkingOutgoing.set(edge.fromNodeId, list);
    }

    const latestUpdatedAtMs = [busSlice.latestUpdatedAtMs, railSlice.latestUpdatedAtMs].reduce<number | null>((latest, value) => {
      if (value === null) return latest;
      if (latest === null) return value;
      return Math.max(latest, value);
    }, null);

    const graph: TransitGraph = {
      nodes,
      transitOutgoing,
      walkingOutgoing,
      latestUpdatedAtMs,
    };

    this.cache.set(dateString, {
      builtAtMs: Date.now(),
      graph,
    });

    return graph;
  }
}
