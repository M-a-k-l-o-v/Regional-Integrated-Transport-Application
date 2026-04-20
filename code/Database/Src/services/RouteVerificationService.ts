import type { TransportApiClient } from "../domain/interfaces/TransportApiClient";
import type { VerificationRepository } from "../infrastructure/repositories/VerificationRepository";

export type VerificationResult = {
  scheduleId: string;
  stationCrs: string;
  scheduledDeparture: string | null;
  liveMatched: boolean;
  liveDepartureTime: string | null;
  liveExpectedTime: string | null;
  variationMinutes: number | null;
  agreement: "match" | "divergence" | "unknown";
  notes: string;
};

function formatRailTime(raw: string | null): string | null {
  if (!raw) return null;
  const m = /^(\d{2})(\d{2})/.exec(raw.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const parseHHMM = (value: string) => {
    const m = /^(\d{2}):(\d{2})/.exec(value);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const aMin = parseHHMM(a);
  const bMin = parseHHMM(b);
  if (aMin === null || bMin === null) return null;
  return bMin - aMin;
}

/**
 * Cross-references the stored timetable view of a service against the live
 * departure board. Depends on TransportApiClient (the abstraction) rather
 * than a concrete client, so a new provider can be swapped in without
 * touching this code (Liskov / Dependency Inversion).
 */
export class RouteVerificationService {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly transportClient: TransportApiClient
  ) {}

  async verifyRailDeparture(scheduleId: string, crs: string): Promise<VerificationResult> {
    const stored = await this.repository.findScheduledRailDeparture(scheduleId, crs);
    const scheduledDeparture = formatRailTime(stored?.publicDeparture ?? null);

    if (!stored) {
      return {
        scheduleId,
        stationCrs: crs,
        scheduledDeparture,
        liveMatched: false,
        liveDepartureTime: null,
        liveExpectedTime: null,
        variationMinutes: null,
        agreement: "unknown",
        notes: "No stored schedule row found for this scheduleId + CRS pair.",
      };
    }

    let liveBoard;
    try {
      liveBoard = await this.transportClient.getRailDepartures(crs);
    } catch (err) {
      return {
        scheduleId,
        stationCrs: crs,
        scheduledDeparture,
        liveMatched: false,
        liveDepartureTime: null,
        liveExpectedTime: null,
        variationMinutes: null,
        agreement: "unknown",
        notes: `Live board lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const candidates = [...liveBoard.trainServices, ...liveBoard.busServices];
    const match = candidates.find((service) => service.std === scheduledDeparture);

    if (!match) {
      return {
        scheduleId,
        stationCrs: crs,
        scheduledDeparture,
        liveMatched: false,
        liveDepartureTime: null,
        liveExpectedTime: null,
        variationMinutes: null,
        agreement: "divergence",
        notes: "Scheduled departure not present on the current live board — possible cancellation or data gap.",
      };
    }

    const variation = minutesBetween(match.std, match.etd);
    const agreement: VerificationResult["agreement"] =
      match.etd === "On time" || variation === 0 ? "match" : "divergence";

    return {
      scheduleId,
      stationCrs: crs,
      scheduledDeparture,
      liveMatched: true,
      liveDepartureTime: match.std,
      liveExpectedTime: match.etd,
      variationMinutes: variation,
      agreement,
      notes:
        agreement === "match"
          ? "Stored timetable agrees with the live board."
          : "Live board reports a variation from the stored timetable.",
    };
  }
}
