import { PrismaClient } from "@prisma/client";
import { BusLiveDelayStore } from "../../infrastructure/liveData/BusLiveDelayStore";
import { LiveMovementStore } from "../../infrastructure/liveData/LiveMovementStore";
import { BusRoutingAdapter } from "./BusRoutingAdapter";
import { RailRoutingAdapter } from "./RailRoutingAdapter";
import { StationFrontageTransferBuilder } from "./StationFrontageTransferBuilder";
import { WalkingTransferBuilder } from "./WalkingTransferBuilder";
import { TransitEdge, TransitGraph, TransitMode } from "./types";

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

  constructor(
    prisma: PrismaClient,
    liveMovementStore?: LiveMovementStore,
    busLiveDelayStore?: BusLiveDelayStore,
  ) {
    this.busAdapter = new BusRoutingAdapter(prisma, busLiveDelayStore);
    this.railAdapter = new RailRoutingAdapter(prisma, liveMovementStore);
    this.walkingTransferBuilder = new WalkingTransferBuilder();
    this.stationFrontageTransferBuilder = new StationFrontageTransferBuilder(prisma);
  }

  async build(dateString: string, modes?: TransitMode[]): Promise<TransitGraph> {
    const cacheKey = modes ? `${dateString}:${[...modes].sort().join(",")}` : dateString;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.builtAtMs < CACHE_TTL_MS) {
      return cached.graph;
    }

    const includeBus = !modes || modes.includes("bus");
    const includeRail = !modes || modes.includes("rail");

    const [busSlice, railSlice] = await Promise.all([
      includeBus ? this.busAdapter.build(dateString) : Promise.resolve({ nodes: [], transitEdges: [], latestUpdatedAtMs: null }),
      includeRail ? this.railAdapter.build(dateString) : Promise.resolve({ nodes: [], transitEdges: [], latestUpdatedAtMs: null }),
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

    this.cache.set(cacheKey, {
      builtAtMs: Date.now(),
      graph,
    });

    return graph;
  }
}
