import { describe, it, expect } from "vitest";
import { JourneyResponseMapper } from "../services/journeys/JourneyResponseMapper";
import type { JourneyNode, SearchLabel, TakenEdge, TransitGraph } from "../services/journeys/types";

function node(partial: Partial<JourneyNode> & Pick<JourneyNode, "nodeId" | "id">): JourneyNode {
  return {
    type: "station",
    code: partial.id,
    name: partial.id,
    latitude: null,
    longitude: null,
    ...partial,
  } as JourneyNode;
}

function graph(nodes: JourneyNode[]): TransitGraph {
  return {
    nodes: new Map(nodes.map((n) => [n.nodeId, n])),
    transitOutgoing: new Map(),
    walkingOutgoing: new Map(),
    latestUpdatedAtMs: null,
  };
}

function edge(partial: Partial<TakenEdge> & Pick<TakenEdge, "fromNodeId" | "toNodeId" | "actualArrivalTimeMs">): TakenEdge {
  return {
    mode: "rail",
    departureTimeMs: partial.actualDepartureTimeMs ?? null,
    arrivalTimeMs: partial.actualArrivalTimeMs,
    durationMinutes: 0,
    serviceKey: null,
    line: null,
    operator: null,
    routeId: null,
    scheduleId: null,
    actualDepartureTimeMs: partial.actualDepartureTimeMs ?? null,
    ...partial,
  } as TakenEdge;
}

describe("JourneyResponseMapper.mapItinerary", () => {
  const mapper = new JourneyResponseMapper();

  it("returns an empty itinerary for a label with no edges", () => {
    const label: SearchLabel = {
      nodeId: "station:A",
      timeMs: Date.UTC(2026, 3, 19, 8, 0, 0),
      transfers: 0,
      walkingMinutes: 0,
      lastServiceKey: null,
      hasBoardedTransit: false,
      edges: [],
    };

    const result = mapper.mapItinerary(label, graph([]));
    expect(result.legs).toEqual([]);
    expect(result.totalMinutes).toBe(0);
    expect(result.transfers).toBe(0);
    expect(result.departureTime).toBe(result.arrivalTime);
  });

  it("maps a simple 1-leg itinerary and computes totalMinutes from arrival - departure", () => {
    const g = graph([
      node({ nodeId: "station:A", id: "A" }),
      node({ nodeId: "station:B", id: "B" }),
    ]);
    const depart = Date.UTC(2026, 3, 19, 8, 0, 0);
    const arrive = Date.UTC(2026, 3, 19, 8, 30, 0);

    const label: SearchLabel = {
      nodeId: "station:B",
      timeMs: arrive,
      transfers: 0,
      walkingMinutes: 0,
      lastServiceKey: "svc:1",
      hasBoardedTransit: true,
      edges: [
        edge({
          fromNodeId: "station:A",
          toNodeId: "station:B",
          actualDepartureTimeMs: depart,
          actualArrivalTimeMs: arrive,
          mode: "rail",
          scheduleId: "sched-1",
        }),
      ],
    };

    const result = mapper.mapItinerary(label, g);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].mode).toBe("rail");
    expect(result.legs[0].from.id).toBe("A");
    expect(result.legs[0].to.id).toBe("B");
    expect(result.totalMinutes).toBe(30);
    expect(result.transfers).toBe(0);
    expect(result.walkingMinutes).toBe(0);
  });

  it("sums walking minutes across walk legs", () => {
    const g = graph([
      node({ nodeId: "station:A", id: "A" }),
      node({ nodeId: "station:B", id: "B" }),
      node({ nodeId: "station:C", id: "C" }),
    ]);
    const t0 = Date.UTC(2026, 3, 19, 8, 0, 0);
    const t1 = t0 + 5 * 60_000;  // +5 min walk
    const t2 = t1 + 30 * 60_000; // +30 min rail

    const label: SearchLabel = {
      nodeId: "station:C",
      timeMs: t2,
      transfers: 0,
      walkingMinutes: 5,
      lastServiceKey: null,
      hasBoardedTransit: true,
      edges: [
        edge({ fromNodeId: "station:A", toNodeId: "station:B", actualDepartureTimeMs: t0, actualArrivalTimeMs: t1, mode: "walk" }),
        edge({ fromNodeId: "station:B", toNodeId: "station:C", actualDepartureTimeMs: t1, actualArrivalTimeMs: t2, mode: "rail", scheduleId: "s1" }),
      ],
    };

    const result = mapper.mapItinerary(label, g);
    expect(result.walkingMinutes).toBe(5);
    expect(result.totalMinutes).toBe(35);
    expect(result.legs).toHaveLength(2);
  });

  it("merges consecutive same-service edges into one leg", () => {
    const g = graph([
      node({ nodeId: "station:A", id: "A" }),
      node({ nodeId: "station:B", id: "B" }),
      node({ nodeId: "station:C", id: "C" }),
    ]);
    const t0 = Date.UTC(2026, 3, 19, 8, 0, 0);
    const t1 = t0 + 15 * 60_000;
    const t2 = t0 + 45 * 60_000;

    const label: SearchLabel = {
      nodeId: "station:C",
      timeMs: t2,
      transfers: 0,
      walkingMinutes: 0,
      lastServiceKey: "sched-1",
      hasBoardedTransit: true,
      edges: [
        edge({ fromNodeId: "station:A", toNodeId: "station:B", actualDepartureTimeMs: t0, actualArrivalTimeMs: t1, mode: "rail", scheduleId: "sched-1" }),
        edge({ fromNodeId: "station:B", toNodeId: "station:C", actualDepartureTimeMs: t1, actualArrivalTimeMs: t2, mode: "rail", scheduleId: "sched-1" }),
      ],
    };

    const result = mapper.mapItinerary(label, g);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].from.id).toBe("A");
    expect(result.legs[0].to.id).toBe("C");
    expect(result.totalMinutes).toBe(45);
  });

  it("does NOT merge legs with different scheduleIds (e.g. after a change)", () => {
    const g = graph([
      node({ nodeId: "station:A", id: "A" }),
      node({ nodeId: "station:B", id: "B" }),
      node({ nodeId: "station:C", id: "C" }),
    ]);
    const t0 = Date.UTC(2026, 3, 19, 8, 0, 0);
    const t1 = t0 + 15 * 60_000;
    const t2 = t0 + 40 * 60_000;

    const label: SearchLabel = {
      nodeId: "station:C",
      timeMs: t2,
      transfers: 1,
      walkingMinutes: 0,
      lastServiceKey: "sched-2",
      hasBoardedTransit: true,
      edges: [
        edge({ fromNodeId: "station:A", toNodeId: "station:B", actualDepartureTimeMs: t0, actualArrivalTimeMs: t1, mode: "rail", scheduleId: "sched-1" }),
        edge({ fromNodeId: "station:B", toNodeId: "station:C", actualDepartureTimeMs: t1, actualArrivalTimeMs: t2, mode: "rail", scheduleId: "sched-2" }),
      ],
    };

    const result = mapper.mapItinerary(label, g);
    expect(result.legs).toHaveLength(2);
    expect(result.transfers).toBe(1);
  });

  it("skips zero-length self-walk edges (same node, walk mode)", () => {
    const g = graph([
      node({ nodeId: "station:A", id: "A" }),
      node({ nodeId: "station:B", id: "B" }),
    ]);
    const t0 = Date.UTC(2026, 3, 19, 8, 0, 0);

    const label: SearchLabel = {
      nodeId: "station:B",
      timeMs: t0 + 30 * 60_000,
      transfers: 0,
      walkingMinutes: 0,
      lastServiceKey: null,
      hasBoardedTransit: true,
      edges: [
        edge({ fromNodeId: "station:A", toNodeId: "station:A", actualDepartureTimeMs: t0, actualArrivalTimeMs: t0, mode: "walk" }),
        edge({ fromNodeId: "station:A", toNodeId: "station:B", actualDepartureTimeMs: t0, actualArrivalTimeMs: t0 + 30 * 60_000, mode: "rail", scheduleId: "s" }),
      ],
    };

    const result = mapper.mapItinerary(label, g);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].mode).toBe("rail");
  });

  it("propagates live delay minutes and recovers scheduledDepartureTime", () => {
    const g = graph([
      node({ nodeId: "station:A", id: "A" }),
      node({ nodeId: "station:B", id: "B" }),
    ]);
    const scheduledDep = Date.UTC(2026, 3, 19, 8, 0, 0);
    const actualDep = scheduledDep + 3 * 60_000; // 3 min late
    const actualArr = actualDep + 30 * 60_000;

    const label: SearchLabel = {
      nodeId: "station:B",
      timeMs: actualArr,
      transfers: 0,
      walkingMinutes: 0,
      lastServiceKey: "s",
      hasBoardedTransit: true,
      edges: [
        edge({
          fromNodeId: "station:A",
          toNodeId: "station:B",
          actualDepartureTimeMs: actualDep,
          actualArrivalTimeMs: actualArr,
          mode: "rail",
          scheduleId: "s",
          liveDelayMinutes: 3,
        }),
      ],
    };

    const result = mapper.mapItinerary(label, g);
    expect(result.legs[0].liveDelayMinutes).toBe(3);
    expect(result.legs[0].scheduledDepartureTime).toBe(new Date(scheduledDep).toISOString());
  });
});
