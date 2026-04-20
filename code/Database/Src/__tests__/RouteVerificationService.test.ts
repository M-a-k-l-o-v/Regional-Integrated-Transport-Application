import { describe, it, expect, vi } from "vitest";
import { RouteVerificationService } from "../services/RouteVerificationService";
import type { VerificationRepository, ScheduledRailDeparture } from "../infrastructure/repositories/VerificationRepository";
import type { TransportApiClient } from "../domain/interfaces/TransportApiClient";
import type { RailBoardSnapshot } from "../infrastructure/apiClients/TransportServerClient";

function makeRepo(stored: ScheduledRailDeparture | null): VerificationRepository {
  return {
    findScheduledRailDeparture: vi.fn().mockResolvedValue(stored),
  } as unknown as VerificationRepository;
}

function makeClient(board: RailBoardSnapshot | Error): TransportApiClient {
  const fn = vi.fn();
  if (board instanceof Error) fn.mockRejectedValue(board);
  else fn.mockResolvedValue(board);
  return {
    getWeather: vi.fn(),
    getRailDepartures: fn,
    getBusLive: vi.fn(),
  };
}

function emptyBoard(): RailBoardSnapshot {
  return {
    generatedAt: null,
    locationName: null,
    crs: "PRE",
    nrccMessages: [],
    trainServices: [],
    busServices: [],
  };
}

describe("RouteVerificationService", () => {
  it("returns agreement=unknown when no stored row is found", async () => {
    const svc = new RouteVerificationService(makeRepo(null), makeClient(emptyBoard()));
    const result = await svc.verifyRailDeparture("S123", "pre");

    expect(result.agreement).toBe("unknown");
    expect(result.liveMatched).toBe(false);
    expect(result.notes).toMatch(/No stored schedule row/);
  });

  it("returns agreement=unknown and surfaces the error when the live client throws", async () => {
    const stored: ScheduledRailDeparture = {
      scheduleId: "S123",
      trainUid: "X12345",
      stationId: "PRE",
      publicDeparture: "0830",
    };
    const svc = new RouteVerificationService(
      makeRepo(stored),
      makeClient(new Error("upstream down"))
    );
    const result = await svc.verifyRailDeparture("S123", "PRE");

    expect(result.agreement).toBe("unknown");
    expect(result.liveMatched).toBe(false);
    expect(result.scheduledDeparture).toBe("08:30");
    expect(result.notes).toMatch(/upstream down/);
  });

  it("returns agreement=divergence when the scheduled time is missing from the live board", async () => {
    const stored: ScheduledRailDeparture = {
      scheduleId: "S123",
      trainUid: "X12345",
      stationId: "PRE",
      publicDeparture: "0830",
    };
    const board: RailBoardSnapshot = {
      ...emptyBoard(),
      trainServices: [
        {
          std: "09:00",
          etd: "On time",
          platform: "3",
          operator: "Avanti",
          operatorCode: "VT",
          serviceType: "train",
          serviceId: "abc",
          rsid: null,
          originName: "London",
          destinationName: "Glasgow",
        },
      ],
    };
    const svc = new RouteVerificationService(makeRepo(stored), makeClient(board));
    const result = await svc.verifyRailDeparture("S123", "PRE");

    expect(result.agreement).toBe("divergence");
    expect(result.liveMatched).toBe(false);
    expect(result.notes).toMatch(/not present on the current live board/);
  });

  it("returns agreement=match when the live board says 'On time'", async () => {
    const stored: ScheduledRailDeparture = {
      scheduleId: "S123",
      trainUid: "X12345",
      stationId: "PRE",
      publicDeparture: "0830",
    };
    const board: RailBoardSnapshot = {
      ...emptyBoard(),
      trainServices: [
        {
          std: "08:30",
          etd: "On time",
          platform: "3",
          operator: "Avanti",
          operatorCode: "VT",
          serviceType: "train",
          serviceId: "abc",
          rsid: null,
          originName: "London",
          destinationName: "Glasgow",
        },
      ],
    };
    const svc = new RouteVerificationService(makeRepo(stored), makeClient(board));
    const result = await svc.verifyRailDeparture("S123", "PRE");

    expect(result.agreement).toBe("match");
    expect(result.liveMatched).toBe(true);
    expect(result.scheduledDeparture).toBe("08:30");
    expect(result.liveDepartureTime).toBe("08:30");
    expect(result.liveExpectedTime).toBe("On time");
  });

  it("returns agreement=divergence when the live etd differs from std", async () => {
    const stored: ScheduledRailDeparture = {
      scheduleId: "S123",
      trainUid: "X12345",
      stationId: "PRE",
      publicDeparture: "0830",
    };
    const board: RailBoardSnapshot = {
      ...emptyBoard(),
      trainServices: [
        {
          std: "08:30",
          etd: "08:45",
          platform: "3",
          operator: "Avanti",
          operatorCode: "VT",
          serviceType: "train",
          serviceId: "abc",
          rsid: null,
          originName: "London",
          destinationName: "Glasgow",
        },
      ],
    };
    const svc = new RouteVerificationService(makeRepo(stored), makeClient(board));
    const result = await svc.verifyRailDeparture("S123", "PRE");

    expect(result.agreement).toBe("divergence");
    expect(result.liveMatched).toBe(true);
    expect(result.variationMinutes).toBe(15);
  });

  it("also checks the busServices array on the rail board", async () => {
    const stored: ScheduledRailDeparture = {
      scheduleId: "S123",
      trainUid: "X12345",
      stationId: "PRE",
      publicDeparture: "0830",
    };
    const board: RailBoardSnapshot = {
      ...emptyBoard(),
      trainServices: [],
      busServices: [
        {
          std: "08:30",
          etd: "On time",
          platform: null,
          operator: "Replacement",
          operatorCode: "RB",
          serviceType: "bus",
          serviceId: "bus-1",
          rsid: null,
          originName: "A",
          destinationName: "B",
        },
      ],
    };
    const svc = new RouteVerificationService(makeRepo(stored), makeClient(board));
    const result = await svc.verifyRailDeparture("S123", "PRE");

    expect(result.agreement).toBe("match");
    expect(result.liveMatched).toBe(true);
  });
});
