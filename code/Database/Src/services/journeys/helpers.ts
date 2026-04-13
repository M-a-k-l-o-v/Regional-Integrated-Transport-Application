import { JourneyNode, JourneyPreference, SearchLabel } from "./types";

export function toNodeId(type: JourneyNode["type"], id: string): string {
  return `${type}:${id}`;
}

export function getLocalDayRange(dateString: string): { dayStart: Date; nextDayStart: Date } {
  const dayStart = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error(`Invalid planner date: ${dateString}`);
  }
  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);
  return { dayStart, nextDayStart };
}

export function parsePlannerDateTime(date: string, time: string): Date {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid planner datetime: ${date} ${time}`);
  }
  return parsed;
}

export function getDayIndexMondayZero(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function parseRailTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})(\d{2})/);
  if (!match) return null;
  const hh = Number.parseInt(match[1], 10);
  const mm = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 47 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function minutesToDate(baseDate: Date, minutes: number): Date {
  const next = new Date(baseDate);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(minutes, 0, 0);
  return next;
}

export function haversineDistanceMetres(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);
  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLon = toRadians(longitudeB - longitudeA);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export function getRouteCode(routeId: string): string {
  return routeId.split(":").pop() ?? routeId;
}

export function getBusServiceLabel(lineRef: string | null | undefined, routeId: string): string {
  const candidate = lineRef?.trim();
  if (candidate) {
    return candidate.includes(":") ? (candidate.split(":").pop() ?? candidate) : candidate;
  }
  return getRouteCode(routeId);
}

export function scoreLabel(label: SearchLabel, preference: JourneyPreference): number {
  if (preference === "fewest_changes") {
    return label.transfers * 10_000_000_000 + label.timeMs;
  }
  if (preference === "balanced") {
    return label.timeMs + label.transfers * 10 * 60 * 1000;
  }
  return label.timeMs + label.transfers * 1000;
}

export function formatPlannerIso(valueMs: number | null): string | null {
  if (valueMs === null) return null;
  return new Date(valueMs).toISOString();
}
