/**
 * In-memory store for live train movement events received via the STOMP feed.
 * Entries expire after a configurable TTL (default 45 minutes).
 *
 * The store is keyed by loc_stanox + train_id so the departures endpoint
 * can quickly look up whether any live movement data exists for a given station.
 */

export type LiveMovementEntry = {
  trainId: string;
  eventType: string; // DEPARTURE | ARRIVAL | PASSING
  stanox: string;
  /** Epoch ms of the actual event, null if not reported */
  actualTimestampMs: number | null;
  /** Positive = late, negative = early, null if unknown */
  timetableVariationMinutes: number | null;
  variationStatus: string | null; // "ON TIME" | "LATE" | "EARLY" | "OFF ROUTE" | null
  platform: string | null;
  /** Epoch ms when this record was received — used for TTL eviction */
  receivedAtMs: number;
};

export class LiveMovementStore {
  private readonly entries = new Map<string, LiveMovementEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 45 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  record(entry: Omit<LiveMovementEntry, "receivedAtMs">): void {
    const key = `${entry.stanox}::${entry.trainId}::${entry.eventType}`;
    this.entries.set(key, { ...entry, receivedAtMs: Date.now() });
  }

  getForStanox(stanox: string): LiveMovementEntry[] {
    const now = Date.now();
    const result: LiveMovementEntry[] = [];
    for (const [key, entry] of this.entries) {
      if (now - entry.receivedAtMs > this.ttlMs) {
        this.entries.delete(key);
        continue;
      }
      if (entry.stanox === stanox) {
        result.push(entry);
      }
    }
    return result;
  }

  /** Match a departure from the scheduled board against recorded live movements.
   *  Returns the best matching entry or null. Matching is by event type DEPARTURE
   *  and time proximity (within ±5 minutes of the scheduled departure minute). */
  findDeparture(stanox: string, scheduledMinuteOfDay: number): LiveMovementEntry | null {
    const candidates = this.getForStanox(stanox).filter((e) => e.eventType === "DEPARTURE");
    if (candidates.length === 0) return null;

    let best: LiveMovementEntry | null = null;
    let bestDiff = Infinity;

    for (const entry of candidates) {
      if (entry.actualTimestampMs === null) continue;
      const actualDate = new Date(entry.actualTimestampMs);
      const actualMinute = actualDate.getUTCHours() * 60 + actualDate.getUTCMinutes();
      const diff = Math.abs(actualMinute - scheduledMinuteOfDay);
      if (diff <= 5 && diff < bestDiff) {
        bestDiff = diff;
        best = entry;
      }
    }
    return best;
  }

  /** Remove expired entries. Call periodically (e.g. every 10 minutes). */
  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.receivedAtMs > this.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
