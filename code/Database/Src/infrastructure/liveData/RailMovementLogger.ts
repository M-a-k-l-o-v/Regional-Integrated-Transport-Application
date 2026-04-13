import { PrismaClient } from "@prisma/client";
import type { LiveMovementEntry } from "./LiveMovementStore";

/**
 * Persists TRUST type-0003 movement messages to the RailMovementLog table
 * for delay trend analysis and per-station reliability scoring (FR-06).
 *
 * Writes are fire-and-forget so STOMP message handling is never blocked.
 */
export class RailMovementLogger {
  constructor(private readonly prisma: PrismaClient) {}

  log(entry: Omit<LiveMovementEntry, "receivedAtMs">): void {
    void this.prisma.railMovementLog
      .create({
        data: {
          trainId: entry.trainId,
          stanox: entry.stanox,
          eventType: entry.eventType,
          timetableVariationMinutes: entry.timetableVariationMinutes,
          variationStatus: entry.variationStatus,
          platform: entry.platform,
          actualTimestampMs:
            entry.actualTimestampMs !== null ? BigInt(entry.actualTimestampMs) : null,
        },
      })
      .catch(() => {
        // Silently ignore DB write failures — logging must never interrupt the live feed
      });
  }
}
