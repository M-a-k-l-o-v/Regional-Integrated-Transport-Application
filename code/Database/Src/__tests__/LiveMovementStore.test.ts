import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveMovementStore } from "../infrastructure/liveData/LiveMovementStore";

describe("LiveMovementStore", () => {
  let store: LiveMovementStore;

  beforeEach(() => {
    store = new LiveMovementStore(60_000); // 1 min TTL for tests
  });

  it("records a movement and returns it for the correct stanox", () => {
    store.record({
      trainId: "1A050001AA",
      eventType: "DEPARTURE",
      stanox: "32510",
      actualTimestampMs: 1_700_000_000_000,
      timetableVariationMinutes: 2,
      variationStatus: "LATE",
      platform: "2",
    });

    const results = store.getForStanox("32510");
    expect(results).toHaveLength(1);
    expect(results[0].trainId).toBe("1A050001AA");
    expect(results[0].timetableVariationMinutes).toBe(2);
  });

  it("does not return entries for a different stanox", () => {
    store.record({
      trainId: "1A050001AA",
      eventType: "DEPARTURE",
      stanox: "32510",
      actualTimestampMs: null,
      timetableVariationMinutes: null,
      variationStatus: null,
      platform: null,
    });

    expect(store.getForStanox("99999")).toHaveLength(0);
  });

  it("expires old entries on getForStanox", () => {
    const expiredStore = new LiveMovementStore(100); // 100ms TTL

    expiredStore.record({
      trainId: "1A050001AA",
      eventType: "DEPARTURE",
      stanox: "32510",
      actualTimestampMs: Date.now(),
      timetableVariationMinutes: 0,
      variationStatus: "ON TIME",
      platform: "1",
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(expiredStore.getForStanox("32510")).toHaveLength(0);
        resolve();
      }, 150);
    });
  });

  it("replaces an existing entry with the same key", () => {
    const entry = {
      trainId: "1A050001AA",
      eventType: "DEPARTURE",
      stanox: "32510",
      actualTimestampMs: 1_700_000_000_000,
      timetableVariationMinutes: 2,
      variationStatus: "LATE",
      platform: "2",
    };
    store.record(entry);
    store.record({ ...entry, timetableVariationMinutes: 5 });

    const results = store.getForStanox("32510");
    expect(results).toHaveLength(1);
    expect(results[0].timetableVariationMinutes).toBe(5);
  });

  it("tracks size correctly", () => {
    expect(store.size).toBe(0);
    store.record({
      trainId: "A",
      eventType: "DEPARTURE",
      stanox: "111",
      actualTimestampMs: null,
      timetableVariationMinutes: null,
      variationStatus: null,
      platform: null,
    });
    store.record({
      trainId: "B",
      eventType: "DEPARTURE",
      stanox: "222",
      actualTimestampMs: null,
      timetableVariationMinutes: null,
      variationStatus: null,
      platform: null,
    });
    expect(store.size).toBe(2);
  });

  describe("findDeparture", () => {
    it("matches by stanox and time proximity", () => {
      // Scheduled at 09:30 = 570 minutes into day
      // Actual at 09:32 UTC
      const actualMs = new Date("2024-01-15T09:32:00.000Z").getTime();

      store.record({
        trainId: "1B060002BB",
        eventType: "DEPARTURE",
        stanox: "32510",
        actualTimestampMs: actualMs,
        timetableVariationMinutes: 2,
        variationStatus: "LATE",
        platform: "3",
      });

      const match = store.findDeparture("32510", 570); // 09:30
      expect(match).not.toBeNull();
      expect(match?.trainId).toBe("1B060002BB");
    });

    it("returns null when no departure is within ±5 minutes", () => {
      const actualMs = new Date("2024-01-15T10:00:00.000Z").getTime(); // 600 mins
      store.record({
        trainId: "1C",
        eventType: "DEPARTURE",
        stanox: "32510",
        actualTimestampMs: actualMs,
        timetableVariationMinutes: 0,
        variationStatus: "ON TIME",
        platform: null,
      });

      // Scheduled at 09:00 = 540 mins, actual is 600 mins — 60 min apart
      expect(store.findDeparture("32510", 540)).toBeNull();
    });

    it("ignores non-DEPARTURE events", () => {
      const actualMs = new Date("2024-01-15T09:30:00.000Z").getTime();
      store.record({
        trainId: "1D",
        eventType: "ARRIVAL",
        stanox: "32510",
        actualTimestampMs: actualMs,
        timetableVariationMinutes: 0,
        variationStatus: "ON TIME",
        platform: null,
      });

      expect(store.findDeparture("32510", 570)).toBeNull();
    });
  });

  it("evictExpired removes old entries", () => {
    const shortTtlStore = new LiveMovementStore(100);
    shortTtlStore.record({
      trainId: "X",
      eventType: "DEPARTURE",
      stanox: "111",
      actualTimestampMs: null,
      timetableVariationMinutes: null,
      variationStatus: null,
      platform: null,
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        shortTtlStore.evictExpired();
        expect(shortTtlStore.size).toBe(0);
        resolve();
      }, 150);
    });
  });
});
