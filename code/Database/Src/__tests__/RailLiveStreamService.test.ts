import { describe, it, expect, vi } from "vitest";
import { RailLiveStreamService } from "../services/liveRail/RailLiveStreamService";

describe("RailLiveStreamService", () => {
  it("does not start when enabled is false", () => {
    const service = new RailLiveStreamService({
      enabled: false,
      host: "localhost",
      port: 61618,
      username: "user",
      password: "pass",
      topics: ["TRAIN_MVT_ALL_TOC"],
    });

    // start() should be a no-op when disabled
    expect(() => service.start()).not.toThrow();
    const status = service.getStatus();
    expect(status.started).toBe(false);
    expect(status.connected).toBe(false);
  });

  it("reports correct initial status", () => {
    const service = new RailLiveStreamService({
      enabled: true,
      host: "stomp.example.com",
      port: 61618,
      username: "user",
      password: "pass",
      topics: ["TRAIN_MVT_ALL_TOC", "VSTP_ALL"],
    });

    const status = service.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.started).toBe(false);
    expect(status.connected).toBe(false);
    expect(status.host).toBe("stomp.example.com");
    expect(status.port).toBe(61618);
    expect(status.lastConnectedAt).toBeNull();
    expect(status.lastError).toBeNull();
    expect(status.topics).toHaveLength(2);
    expect(status.topics[0].topic).toBe("TRAIN_MVT_ALL_TOC");
    expect(status.topics[0].subscribed).toBe(false);
    expect(status.topics[0].messageCount).toBe(0);
  });

  describe("parseAndEmitMovements (via onMovement callback)", () => {
    it("calls onMovement for valid TRAIN_MVT messages", () => {
      const onMovement = vi.fn();
      const service = new RailLiveStreamService({
        enabled: false,
        host: "localhost",
        port: 61618,
        username: "u",
        password: "p",
        topics: ["TRAIN_MVT_ALL_TOC"],
        onMovement,
      });

      // Access private method via type cast for unit testing
      const parseAndEmit = (service as unknown as Record<string, Function>)["parseAndEmitMovements"].bind(service);

      const body = JSON.stringify([
        {
          header: { msg_type: "0003" },
          body: {
            event_type: "DEPARTURE",
            loc_stanox: "32510",
            train_id: "1A050001AA",
            actual_timestamp: "1700000000000",
            timetable_variation: "2",
            variation_status: "LATE",
            platform: "3",
          },
        },
      ]);

      parseAndEmit(body, onMovement);

      expect(onMovement).toHaveBeenCalledOnce();
      const call = onMovement.mock.calls[0][0];
      expect(call.eventType).toBe("DEPARTURE");
      expect(call.stanox).toBe("32510");
      expect(call.trainId).toBe("1A050001AA");
      expect(call.actualTimestampMs).toBe(1700000000000);
      expect(call.timetableVariationMinutes).toBe(2);
      expect(call.variationStatus).toBe("LATE");
      expect(call.platform).toBe("3");
    });

    it("skips messages missing stanox or trainId", () => {
      const onMovement = vi.fn();
      const service = new RailLiveStreamService({
        enabled: false,
        host: "localhost",
        port: 61618,
        username: "u",
        password: "p",
        topics: ["TRAIN_MVT_ALL_TOC"],
      });
      const parseAndEmit = (service as unknown as Record<string, Function>)["parseAndEmitMovements"].bind(service);

      const body = JSON.stringify([
        { body: { event_type: "DEPARTURE", train_id: "1A" } }, // missing stanox
        { body: { event_type: "DEPARTURE", loc_stanox: "32510" } }, // missing trainId
      ]);

      parseAndEmit(body, onMovement);
      expect(onMovement).not.toHaveBeenCalled();
    });

    it("handles malformed JSON without throwing", () => {
      const onMovement = vi.fn();
      const service = new RailLiveStreamService({
        enabled: false,
        host: "localhost",
        port: 61618,
        username: "u",
        password: "p",
        topics: ["TRAIN_MVT_ALL_TOC"],
      });
      const parseAndEmit = (service as unknown as Record<string, Function>)["parseAndEmitMovements"].bind(service);

      expect(() => parseAndEmit("not valid json", onMovement)).not.toThrow();
      expect(onMovement).not.toHaveBeenCalled();
    });

    it("handles an array with multiple valid movements", () => {
      const onMovement = vi.fn();
      const service = new RailLiveStreamService({
        enabled: false,
        host: "localhost",
        port: 61618,
        username: "u",
        password: "p",
        topics: ["TRAIN_MVT_ALL_TOC"],
      });
      const parseAndEmit = (service as unknown as Record<string, Function>)["parseAndEmitMovements"].bind(service);

      const body = JSON.stringify([
        { body: { event_type: "DEPARTURE", loc_stanox: "111", train_id: "A", actual_timestamp: "1700000000000", timetable_variation: "0", variation_status: "ON TIME", platform: "1" } },
        { body: { event_type: "ARRIVAL", loc_stanox: "222", train_id: "B", actual_timestamp: "", timetable_variation: "", variation_status: null, platform: "" } },
      ]);

      parseAndEmit(body, onMovement);
      expect(onMovement).toHaveBeenCalledTimes(2);
      expect(onMovement.mock.calls[1][0].eventType).toBe("ARRIVAL");
      expect(onMovement.mock.calls[1][0].actualTimestampMs).toBeNull();
      expect(onMovement.mock.calls[1][0].platform).toBeNull();
    });
  });
});
