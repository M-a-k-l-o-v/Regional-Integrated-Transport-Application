import { formatBusStopGroupMemberName } from "../busStopGroups";
import { formatPlannerIso } from "./helpers";
import { JourneyItineraryResponse, JourneyLegResponse, JourneyNode, SearchLabel, TakenEdge, TransitGraph } from "./types";

function toResponseLocation(node: JourneyNode) {
  return {
    type: node.type,
    id: node.id,
    code: node.code,
    name: node.type === "bus_stop" ? formatBusStopGroupMemberName(node.id, node.name) : node.name,
    latitude: node.latitude,
    longitude: node.longitude,
  };
}

function buildLeg(edge: TakenEdge, graph: TransitGraph): JourneyLegResponse {
  const fromNode = graph.nodes.get(edge.fromNodeId);
  const toNode = graph.nodes.get(edge.toNodeId);
  if (!fromNode || !toNode) {
    throw new Error(`Missing node metadata for edge ${edge.fromNodeId} -> ${edge.toNodeId}`);
  }

  return {
    mode: edge.mode,
    from: toResponseLocation(fromNode),
    to: toResponseLocation(toNode),
    departureTime: formatPlannerIso(edge.actualDepartureTimeMs),
    arrivalTime: formatPlannerIso(edge.actualArrivalTimeMs),
    line: edge.line,
    operator: edge.operator,
    routeId: edge.routeId,
    scheduleId: edge.scheduleId,
    isScheduled: true,
  };
}

export class JourneyResponseMapper {
  mapItinerary(label: SearchLabel, graph: TransitGraph): JourneyItineraryResponse {
    if (label.edges.length === 0) {
      return {
        departureTime: new Date(label.timeMs).toISOString(),
        arrivalTime: new Date(label.timeMs).toISOString(),
        totalMinutes: 0,
        transfers: 0,
        walkingMinutes: 0,
        legs: [],
      };
    }

    const mergedLegs: JourneyLegResponse[] = [];

    for (const edge of label.edges) {
      const fromNode = graph.nodes.get(edge.fromNodeId);
      const toNode = graph.nodes.get(edge.toNodeId);
      if (!fromNode || !toNode) continue;
      if (edge.mode === "walk" && fromNode.type === toNode.type && fromNode.id === toNode.id) {
        continue;
      }

      const previous = mergedLegs[mergedLegs.length - 1] ?? null;

      if (
        previous &&
        previous.mode === edge.mode &&
        previous.scheduleId === edge.scheduleId &&
        previous.to.id === fromNode.id
      ) {
        previous.to = toResponseLocation(toNode);
        previous.arrivalTime = formatPlannerIso(edge.actualArrivalTimeMs);
        continue;
      }

      mergedLegs.push(buildLeg(edge, graph));
    }

    const sanitisedLegs = mergedLegs.filter(
      (leg) => !(leg.mode === "walk" && leg.from.type === leg.to.type && leg.from.id === leg.to.id)
    );
    const effectiveLegs = sanitisedLegs.length > 0 ? sanitisedLegs : mergedLegs;

    const firstLeg = effectiveLegs[0];
    const lastLeg = effectiveLegs[effectiveLegs.length - 1];
    const departureTime = firstLeg.departureTime ?? new Date(label.timeMs).toISOString();
    const arrivalTime = lastLeg.arrivalTime ?? departureTime;
    const totalMinutes = Math.max(0, Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000));
    const walkingMinutes = effectiveLegs.reduce((total, leg) => {
      if (leg.mode !== "walk" || !leg.departureTime || !leg.arrivalTime) return total;
      return total + Math.max(0, Math.round((new Date(leg.arrivalTime).getTime() - new Date(leg.departureTime).getTime()) / 60000));
    }, 0);

    return {
      departureTime,
      arrivalTime,
      totalMinutes,
      transfers: label.transfers,
      walkingMinutes,
      legs: effectiveLegs,
    };
  }
}
