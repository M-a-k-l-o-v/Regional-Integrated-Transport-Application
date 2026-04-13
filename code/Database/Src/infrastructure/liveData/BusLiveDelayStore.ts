/**
 * In-memory store for live bus delay data derived from SIRI-VM MonitoredCall
 * responses. Keyed by (publishedLineName, originAimedDepartureHHMM) so the
 * BusRoutingAdapter can look up a delay for any scheduled journey using only
 * the line label and origin departure time.
 */

const TTL_MS = 30 * 60 * 1000; // 30 minutes

export type BusDelayEntry = {
  lineLabel: string;
  originHHMM: string;
  delayMinutes: number;
  recordedAtMs: number;
};

function entryKey(lineLabel: string, originHHMM: string): string {
  return `${lineLabel}::${originHHMM}`;
}

/** Extract HH:MM from an ISO-8601 datetime string using local time. */
function isoToLocalHHMM(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Extract HH:MM from any Date using local time. */
export function dateToLocalHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export class BusLiveDelayStore {
  private readonly entries = new Map<string, BusDelayEntry>();

  get size(): number {
    return this.entries.size;
  }

  /**
   * Record a delay entry. Overwrites any existing entry for the same key so
   * that the most-recently-received data always wins.
   */
  record(entry: BusDelayEntry): void {
    const key = entryKey(entry.lineLabel, entry.originHHMM);
    this.entries.set(key, entry);
  }

  /**
   * Look up a live delay for a journey identified by its display line label
   * (e.g. "4") and the local HH:MM of its origin departure.
   */
  findDelay(lineLabel: string, originDeparture: Date): number | null {
    const hhmm = dateToLocalHHMM(originDeparture);
    const entry = this.entries.get(entryKey(lineLabel, hhmm));
    if (!entry) return null;
    if (Date.now() - entry.recordedAtMs > TTL_MS) {
      this.entries.delete(entryKey(lineLabel, hhmm));
      return null;
    }
    return entry.delayMinutes;
  }

  evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.recordedAtMs > TTL_MS) {
        this.entries.delete(key);
      }
    }
  }
}
