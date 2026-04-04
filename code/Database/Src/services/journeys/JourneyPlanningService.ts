import { PrismaClient } from "@prisma/client";
import { getBusStopGroup } from "../busStopGroups";
import { haversineDistanceMetres, parsePlannerDateTime, scoreLabel, toNodeId } from "./helpers";
import { JourneyResponseMapper } from "./JourneyResponseMapper";
import { TransitGraphBuilder } from "./TransitGraphBuilder";
import {
  AccessCandidate,
  JourneyItineraryResponse,
  JourneyPlanRequest,
  JourneyPlanResponse,
  JourneyPreference,
  PlannerLocationRef,
  SearchLabel,
  TakenEdge,
  TransitEdge,
  TransitGraph,
} from "./types";

const MAX_SEARCH_HOURS = 12;
const MAX_TRANSFERS = 4;
const MAX_LABEL_EXPANSIONS = 20000;
const MAX_LABELS_PER_NODE = 48;
const ACCESS_RADIUS_METRES = 1500;
const ACCESS_WALK_SPEED_METRES_PER_SECOND = 1.3;
const STATION_FRONTAGE_WALK_MINUTES = 4;

type ResolvedLocation = {
  type: "station" | "bus_stop" | "bus_stop_group";
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  memberStopIds?: string[];
};

type HeapItem = {
  label: SearchLabel;
  priority: number;
};

class SearchLabelMinHeap {
  private readonly items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(label: SearchLabel, priority: number) {
    this.items.push({ label, priority });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): SearchLabel | null {
    if (this.items.length === 0) return null;

    const root = this.items[0];
    const tail = this.items.pop() as HeapItem;
    if (this.items.length > 0) {
      this.items[0] = tail;
      this.bubbleDown(0);
    }

    return root.label;
  }

  private bubbleUp(index: number) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      if (this.items[parentIndex].priority <= this.items[currentIndex].priority) {
        break;
      }

      [this.items[parentIndex], this.items[currentIndex]] = [this.items[currentIndex], this.items[parentIndex]];
      currentIndex = parentIndex;
    }
  }

  private bubbleDown(index: number) {
    let currentIndex = index;

    while (true) {
      const leftIndex = currentIndex * 2 + 1;
      const rightIndex = currentIndex * 2 + 2;
      let nextIndex = currentIndex;

      if (leftIndex < this.items.length && this.items[leftIndex].priority < this.items[nextIndex].priority) {
        nextIndex = leftIndex;
      }

      if (rightIndex < this.items.length && this.items[rightIndex].priority < this.items[nextIndex].priority) {
        nextIndex = rightIndex;
      }

      if (nextIndex === currentIndex) {
        break;
      }

      [this.items[currentIndex], this.items[nextIndex]] = [this.items[nextIndex], this.items[currentIndex]];
      currentIndex = nextIndex;
    }
  }
}

export class JourneyPlanningService {
  private readonly graphBuilder: TransitGraphBuilder;
  private readonly responseMapper = new JourneyResponseMapper();

  constructor(private readonly prisma: PrismaClient) {
    this.graphBuilder = new TransitGraphBuilder(prisma);
  }

  async plan(request: JourneyPlanRequest): Promise<JourneyPlanResponse> {
    const departureDateTime = parsePlannerDateTime(request.date, request.time);
    const graph = await this.graphBuilder.build(request.date);
    const origin = await this.resolveLocation(request.origin, graph);
    const destination = await this.resolveLocation(request.destination, graph);

    this.ensureNodePresent(graph, origin);
    this.ensureNodePresent(graph, destination);

    const originNodeId = toNodeId(origin.type, origin.id);
    const destinationNodeId = toNodeId(destination.type, destination.id);
    const originAccess = await this.buildAccessCandidates(graph, origin);
    const destinationAccess = await this.buildAccessCandidates(graph, destination);

    const itineraries = originAccess.length > 0 && destinationAccess.length > 0
      ? this.searchGraph(
          graph,
          originNodeId,
          destinationNodeId,
          originAccess,
          destinationAccess,
          departureDateTime,
          request.preference,
          request.maxItineraries,
          origin,
          destination
        )
      : [];

    return {
      dataState: {
        mode: "scheduled",
        isLive: false,
        fallback: true,
        lastUpdated: graph.latestUpdatedAtMs ? new Date(graph.latestUpdatedAtMs).toISOString() : null,
      },
      query: {
        origin,
        destination,
        date: request.date,
        time: request.time,
        preference: request.preference,
      },
      itineraries,
    };
  }

  private searchGraph(
    graph: TransitGraph,
    originNodeId: string,
    destinationNodeId: string,
    originAccess: AccessCandidate[],
    destinationAccess: AccessCandidate[],
    departureDateTime: Date,
    preference: JourneyPreference,
    maxItineraries: number,
    origin: ResolvedLocation,
    _destination: ResolvedLocation
  ) {
    const departureTimeMs = departureDateTime.getTime();
    const frontier = new SearchLabelMinHeap();
    const labelsByNode = new Map<string, SearchLabel[]>();
    for (const candidate of originAccess) {
      const seed: SearchLabel = {
        nodeId: candidate.nodeId,
        timeMs: departureTimeMs + candidate.durationMinutes * 60 * 1000,
        transfers: 0,
        walkingMinutes: candidate.durationMinutes,
        lastServiceKey: null,
        hasBoardedTransit: false,
        edges:
          candidate.nodeId === originNodeId || candidate.durationMinutes <= 0
            ? []
            : [this.buildSyntheticWalkEdge(originNodeId, candidate.nodeId, departureTimeMs, candidate.durationMinutes)],
      };
      const existing = labelsByNode.get(seed.nodeId) ?? [];
      existing.push(seed);
      labelsByNode.set(seed.nodeId, existing);
      frontier.push(seed, scoreLabel(seed, preference));
    }
    const destinationLabels: SearchLabel[] = [];
    const searchEndMs = departureDateTime.getTime() + MAX_SEARCH_HOURS * 60 * 60 * 1000;
    const destinationAccessMap = new Map(destinationAccess.map((candidate) => [candidate.nodeId, candidate.durationMinutes]));

    let expansions = 0;
    while (frontier.size > 0 && expansions < MAX_LABEL_EXPANSIONS) {
      const current = frontier.pop();
      if (!current) break;
      if (!this.isActiveLabel(labelsByNode, current)) continue;
      expansions += 1;

      if (current.timeMs > searchEndMs) continue;

      const destinationWalkMinutes = destinationAccessMap.get(current.nodeId);
      if (destinationWalkMinutes !== undefined && current.edges.length > 0) {
        const completed =
          current.nodeId === destinationNodeId
            ? current
            : this.appendDestinationWalk(current, current.nodeId, destinationNodeId, destinationWalkMinutes);
        destinationLabels.push(completed);
        if (destinationLabels.length >= maxItineraries * 24) {
          continue;
        }
      }

      for (const edge of graph.walkingOutgoing.get(current.nodeId) ?? []) {
        const nextLabel = this.createNextLabel(current, edge, current.timeMs + edge.arrivalTimeMs);
        if (this.pushIfViable(labelsByNode, frontier, nextLabel, preference)) {
          // accepted
        }
      }

      const transitEdges = graph.transitOutgoing.get(current.nodeId) ?? [];
      const startIndex = this.findTransitStartIndex(transitEdges, current.timeMs);
      for (let index = startIndex; index < transitEdges.length; index += 1) {
        const edge = transitEdges[index];
        if (edge.departureTimeMs === null) continue;
        if (edge.departureTimeMs < current.timeMs) continue;
        if (edge.departureTimeMs > searchEndMs) break;
        const nextLabel = this.createNextLabel(current, edge, edge.arrivalTimeMs);
        if (nextLabel.transfers > MAX_TRANSFERS) continue;
        this.pushIfViable(labelsByNode, frontier, nextLabel, preference);
      }
    }

    const seen = new Set<string>();
    const deduped = destinationLabels
      .sort((left, right) => scoreLabel(left, preference) - scoreLabel(right, preference))
      .map((label) => this.responseMapper.mapItinerary(label, graph))
      .filter((itinerary) => {
        const signature = itinerary.legs
          .map((leg) => `${leg.mode}:${leg.from.id}:${leg.to.id}:${leg.departureTime}:${leg.arrivalTime}:${leg.line ?? ""}:${leg.routeId ?? ""}`)
          .join("|");
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    const ranked = this.rankReturnedItineraries(deduped, origin);

    const selected: typeof ranked = [];
    const leftovers: typeof ranked = [];
    const usedBoardingPatterns = new Set<string>();

    for (const itinerary of ranked) {
      const firstTransitLeg = itinerary.legs.find((leg) => leg.mode !== "walk") ?? itinerary.legs[0] ?? null;
      const patternKey = firstTransitLeg
        ? `${firstTransitLeg.mode}:${firstTransitLeg.from.id}:${firstTransitLeg.line ?? firstTransitLeg.routeId ?? ""}`
        : "walk-only";

      if (!usedBoardingPatterns.has(patternKey)) {
        selected.push(itinerary);
        usedBoardingPatterns.add(patternKey);
      } else {
        leftovers.push(itinerary);
      }

      if (selected.length >= maxItineraries) {
        return selected;
      }
    }

    for (const itinerary of leftovers) {
      selected.push(itinerary);
      if (selected.length >= maxItineraries) {
        break;
      }
    }

    return selected;
  }

  private rankReturnedItineraries(
    itineraries: JourneyItineraryResponse[],
    origin: ResolvedLocation
  ): JourneyItineraryResponse[] {
    if (origin.type !== "bus_stop_group" || !origin.memberStopIds?.length) {
      return itineraries;
    }

    const directHubBoardingExists = itineraries.some((itinerary) =>
      this.startsWithDirectHubTransit(itinerary, origin)
    );

    if (!directHubBoardingExists) {
      return itineraries;
    }

    return itineraries
      .map((itinerary, index) => ({ itinerary, index }))
      .sort((left, right) => {
        const penaltyDiff =
          this.getOriginHubWalkPenalty(left.itinerary, origin) -
          this.getOriginHubWalkPenalty(right.itinerary, origin);
        if (penaltyDiff !== 0) return penaltyDiff;
        return left.index - right.index;
      })
      .map(({ itinerary }) => itinerary);
  }

  private startsWithDirectHubTransit(
    itinerary: JourneyItineraryResponse,
    origin: ResolvedLocation
  ): boolean {
    if (origin.type !== "bus_stop_group" || !origin.memberStopIds?.length) {
      return false;
    }

    const firstLeg = itinerary.legs[0];
    if (!firstLeg || firstLeg.mode === "walk") {
      return false;
    }

    return firstLeg.from.type === "bus_stop" && origin.memberStopIds.includes(firstLeg.from.id);
  }

  private getOriginHubWalkPenalty(
    itinerary: JourneyItineraryResponse,
    origin: ResolvedLocation
  ): number {
    if (origin.type !== "bus_stop_group") {
      return 0;
    }

    const firstLeg = itinerary.legs[0];
    if (!firstLeg || firstLeg.mode !== "walk") {
      return 0;
    }

    return firstLeg.from.type === "bus_stop_group" && firstLeg.from.id === origin.id ? 1 : 0;
  }

  private createNextLabel(current: SearchLabel, edge: TransitEdge, nextTimeMs: number): SearchLabel {
    const isTransit = edge.mode !== "walk";
    const transfers = !isTransit
      ? current.transfers
      : !current.hasBoardedTransit
        ? current.transfers
        : current.lastServiceKey === edge.serviceKey
          ? current.transfers
          : current.transfers + 1;
    const takenEdge: TakenEdge = {
      ...edge,
      actualDepartureTimeMs: isTransit ? edge.departureTimeMs : current.timeMs,
      actualArrivalTimeMs: nextTimeMs,
    };

    return {
      nodeId: edge.toNodeId,
      timeMs: nextTimeMs,
      transfers,
      walkingMinutes: current.walkingMinutes + (edge.mode === "walk" ? edge.durationMinutes : 0),
      lastServiceKey: isTransit ? edge.serviceKey : null,
      hasBoardedTransit: isTransit ? true : current.hasBoardedTransit,
      edges: [...current.edges, takenEdge],
    };
  }

  private pushIfViable(
    labelsByNode: Map<string, SearchLabel[]>,
    frontier: SearchLabelMinHeap,
    candidate: SearchLabel,
    preference: JourneyPreference
  ): boolean {
    const existing = labelsByNode.get(candidate.nodeId) ?? [];
    if (existing.some((label) => this.dominates(label, candidate))) {
      return false;
    }

    const filtered = existing.filter((label) => !this.dominates(candidate, label));
    filtered.push(candidate);
    filtered.sort((left, right) => scoreLabel(left, preference) - scoreLabel(right, preference));
    labelsByNode.set(candidate.nodeId, filtered.slice(0, MAX_LABELS_PER_NODE));
    frontier.push(candidate, scoreLabel(candidate, preference));
    return true;
  }

  private isActiveLabel(labelsByNode: Map<string, SearchLabel[]>, candidate: SearchLabel): boolean {
    const active = labelsByNode.get(candidate.nodeId);
    return active ? active.includes(candidate) : false;
  }

  private dominates(left: SearchLabel, right: SearchLabel): boolean {
    const betterOrEqual = left.timeMs <= right.timeMs && left.transfers <= right.transfers && left.walkingMinutes <= right.walkingMinutes;
    const strictlyBetter = left.timeMs < right.timeMs || left.transfers < right.transfers || left.walkingMinutes < right.walkingMinutes;
    return betterOrEqual && strictlyBetter;
  }

  private findTransitStartIndex(edges: TransitEdge[], thresholdMs: number): number {
    let low = 0;
    let high = edges.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const value = edges[middle].departureTimeMs ?? 0;
      if (value < thresholdMs) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  private async resolveLocation(ref: PlannerLocationRef, graph: TransitGraph): Promise<ResolvedLocation> {
    const graphNode = graph.nodes.get(toNodeId(ref.type, ref.id));
    if (graphNode) {
      return {
        type: graphNode.type,
        id: graphNode.id,
        code: graphNode.code,
        name: graphNode.name,
        latitude: graphNode.latitude,
        longitude: graphNode.longitude,
      };
    }

    if (ref.type === "station") {
      const station = await this.prisma.station.findUnique({
        where: { stationId: ref.id },
        select: { stationId: true, name: true, latitude: true, longitude: true },
      });
      if (!station) {
        throw new Error(`Station not found: ${ref.id}`);
      }
      return {
        type: "station" as const,
        id: station.stationId,
        code: station.stationId,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
      };
    }

    if (ref.type === "bus_stop_group") {
      const group = getBusStopGroup(ref.id);
      if (!group) {
        throw new Error(`Bus stop group not found: ${ref.id}`);
      }

      return {
        type: "bus_stop_group" as const,
        id: group.groupId,
        code: group.code,
        name: group.name,
        latitude: group.latitude,
        longitude: group.longitude,
        memberStopIds: group.memberStopIds,
      };
    }

    const stop = await this.prisma.busStop.findUnique({
      where: { stopId: ref.id },
      select: { stopId: true, name: true, latitude: true, longitude: true },
    });
    if (!stop) {
      throw new Error(`Bus stop not found: ${ref.id}`);
    }
    return {
      type: "bus_stop" as const,
      id: stop.stopId,
      code: stop.stopId,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
    };
  }

  private ensureNodePresent(graph: TransitGraph, location: ResolvedLocation) {
    const nodeId = toNodeId(location.type, location.id);
    if (graph.nodes.has(nodeId)) return;
    graph.nodes.set(nodeId, {
      nodeId,
      type: location.type,
      id: location.id,
      code: location.code,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }

  private async buildAccessCandidates(graph: TransitGraph, location: ResolvedLocation): Promise<AccessCandidate[]> {
    const exactNodeId = toNodeId(location.type, location.id);
    const candidates = new Map<string, AccessCandidate>();

    if (location.type !== "bus_stop_group") {
      candidates.set(exactNodeId, { nodeId: exactNodeId, durationMinutes: 0 });
    }

    if (location.type === "bus_stop_group" && location.memberStopIds && location.memberStopIds.length > 0) {
      const memberNodeIds = location.memberStopIds.map((stopId) => toNodeId("bus_stop", stopId));
      const missingStopIds = location.memberStopIds.filter((stopId) => !graph.nodes.has(toNodeId("bus_stop", stopId)));

      if (missingStopIds.length > 0) {
        const missingStops = await this.prisma.busStop.findMany({
          where: { stopId: { in: missingStopIds } },
          select: {
            stopId: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        });

        for (const stop of missingStops) {
          const nodeId = toNodeId("bus_stop", stop.stopId);
          graph.nodes.set(nodeId, {
            nodeId,
            type: "bus_stop",
            id: stop.stopId,
            code: stop.stopId,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
          });
        }
      }

      for (const nodeId of memberNodeIds) {
        if (graph.nodes.has(nodeId)) {
          candidates.set(nodeId, { nodeId, durationMinutes: 0 });
        }
      }
    }

    if (location.latitude !== null && location.longitude !== null) {
      for (const node of graph.nodes.values()) {
        if (node.latitude === null || node.longitude === null) continue;
        if (node.type !== "bus_stop" && node.type !== "station") continue;

        const distanceMetres = haversineDistanceMetres(
          location.latitude,
          location.longitude,
          node.latitude,
          node.longitude
        );

        if (distanceMetres === 0 || distanceMetres > ACCESS_RADIUS_METRES) continue;

        const durationMinutes = Math.max(1, Math.ceil(distanceMetres / ACCESS_WALK_SPEED_METRES_PER_SECOND / 60));
        const existing = candidates.get(node.nodeId);
        if (!existing || durationMinutes < existing.durationMinutes) {
          candidates.set(node.nodeId, { nodeId: node.nodeId, durationMinutes });
        }
      }
    }

    if (location.type === "station") {
      const frontageStops = await this.findStationFrontageStops(location.name);
      for (const stop of frontageStops) {
        const nodeId = toNodeId("bus_stop", stop.stopId);
        if (!graph.nodes.has(nodeId)) {
          graph.nodes.set(nodeId, {
            nodeId,
            type: "bus_stop",
            id: stop.stopId,
            code: stop.stopId,
            name: stop.name,
            latitude: stop.latitude,
            longitude: stop.longitude,
          });
        }

        const existing = candidates.get(nodeId);
        if (!existing || STATION_FRONTAGE_WALK_MINUTES < existing.durationMinutes) {
          candidates.set(nodeId, {
            nodeId,
            durationMinutes: STATION_FRONTAGE_WALK_MINUTES,
          });
        }
      }
    }

    return Array.from(candidates.values())
      .sort((left, right) => left.durationMinutes - right.durationMinutes)
      .slice(0, location.type === "bus_stop_group" ? 32 : 16);
  }

  private async findStationFrontageStops(stationName: string) {
    const tokens = stationName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !["lancs", "north", "south", "east", "west"].includes(token));

    if (tokens.length === 0) {
      return [];
    }

    const frontageTerms = ["rail station", "railway station", "rail station taxi rank", "station"];

    const stops = await this.prisma.busStop.findMany({
      where: {
        AND: [
          {
            OR: frontageTerms.map((term) => ({
              name: { contains: term, mode: "insensitive" as const },
            })),
          },
          {
            OR: tokens.flatMap((token) => [
              { name: { contains: token, mode: "insensitive" as const } },
              { locality: { name: { contains: token, mode: "insensitive" as const } } },
            ]),
          },
        ],
      },
      select: {
        stopId: true,
        name: true,
        latitude: true,
        longitude: true,
      },
      take: 8,
    });

    return stops.filter((stop) => stop.latitude !== null && stop.longitude !== null);
  }

  private buildSyntheticWalkEdge(
    fromNodeId: string,
    toNodeId: string,
    departureTimeMs: number,
    durationMinutes: number
  ): TakenEdge {
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
      actualDepartureTimeMs: departureTimeMs,
      actualArrivalTimeMs: departureTimeMs + durationMinutes * 60 * 1000,
    };
  }

  private appendDestinationWalk(
    label: SearchLabel,
    accessNodeId: string,
    destinationNodeId: string,
    durationMinutes: number
  ): SearchLabel {
    if (accessNodeId === destinationNodeId || durationMinutes <= 0) {
      return label;
    }

    const walkEdge = this.buildSyntheticWalkEdge(accessNodeId, destinationNodeId, label.timeMs, durationMinutes);
    return {
      ...label,
      nodeId: destinationNodeId,
      timeMs: walkEdge.actualArrivalTimeMs,
      walkingMinutes: label.walkingMinutes + durationMinutes,
      edges: [...label.edges, walkEdge],
    };
  }
}
