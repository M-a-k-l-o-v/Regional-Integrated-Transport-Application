import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReliabilityService } from "../services/ReliabilityService";
import type { DelaySample, ReliabilityRepository } from "../infrastructure/repositories/ReliabilityRepository";

function makeRepo(samples: DelaySample[]): ReliabilityRepository {
  return {
    findDepartureDelays: vi.fn().mockResolvedValue(samples),
  } as unknown as ReliabilityRepository;
}

describe("ReliabilityService", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("returns a zero report when there are no samples", async () => {
    const svc = new ReliabilityService(makeRepo([]));
    const report = await svc.computeStationReliability("52288", 7);
    expect(report).toEqual({
      stanox: "52288",
      days: 7,
      total: 0,
      onTime: 0,
      late: 0,
      early: 0,
      avgDelayMinutes: null,
      buckets: [],
    });
  });

  it("buckets samples into early / onTime / late using <=0, <=1, else", async () => {
    const samples: DelaySample[] = [
      { timetableVariationMinutes: -2, receivedAt: new Date("2026-04-10T08:00:00Z") }, // early
      { timetableVariationMinutes: 0, receivedAt: new Date("2026-04-10T09:00:00Z") },  // early (v<=0)
      { timetableVariationMinutes: 1, receivedAt: new Date("2026-04-10T10:00:00Z") },  // onTime
      { timetableVariationMinutes: 2, receivedAt: new Date("2026-04-10T11:00:00Z") },  // late
      { timetableVariationMinutes: 15, receivedAt: new Date("2026-04-10T12:00:00Z") }, // late
    ];
    const svc = new ReliabilityService(makeRepo(samples));
    const report = await svc.computeStationReliability("52288", 14);

    expect(report.total).toBe(5);
    expect(report.early).toBe(2);
    expect(report.onTime).toBe(1);
    expect(report.late).toBe(2);
    // Average delay: (-2 + 0 + 1 + 2 + 15) / 5 = 3.2
    expect(report.avgDelayMinutes).toBe(3.2);
  });

  it("groups buckets by UTC date and rounds avgDelay to 1dp", async () => {
    const samples: DelaySample[] = [
      { timetableVariationMinutes: 3, receivedAt: new Date("2026-04-10T08:00:00Z") },
      { timetableVariationMinutes: 6, receivedAt: new Date("2026-04-10T22:00:00Z") },
      { timetableVariationMinutes: 1, receivedAt: new Date("2026-04-11T09:00:00Z") },
    ];
    const svc = new ReliabilityService(makeRepo(samples));
    const report = await svc.computeStationReliability("52288", 7);

    expect(report.buckets).toHaveLength(2);
    const byDate = Object.fromEntries(report.buckets.map((b) => [b.date, b]));
    expect(byDate["2026-04-10"]).toEqual({ date: "2026-04-10", count: 2, avgDelay: 4.5 });
    expect(byDate["2026-04-11"]).toEqual({ date: "2026-04-11", count: 1, avgDelay: 1 });
  });

  it("passes the correct 'since' date to the repository", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00Z"));
    const repo = makeRepo([]);
    const svc = new ReliabilityService(repo);
    await svc.computeStationReliability("52288", 7);

    expect(repo.findDepartureDelays).toHaveBeenCalledTimes(1);
    const [stanox, since] = (repo.findDepartureDelays as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(stanox).toBe("52288");
    expect(since).toBeInstanceOf(Date);
    // 7 days before 2026-04-19T12:00:00Z is 2026-04-12T12:00:00Z
    expect((since as Date).toISOString()).toBe("2026-04-12T12:00:00.000Z");
  });

  it("handles a single sample correctly (rounding and buckets)", async () => {
    const samples: DelaySample[] = [
      { timetableVariationMinutes: 7, receivedAt: new Date("2026-04-10T08:00:00Z") },
    ];
    const svc = new ReliabilityService(makeRepo(samples));
    const report = await svc.computeStationReliability("52288", 7);
    expect(report.total).toBe(1);
    expect(report.late).toBe(1);
    expect(report.avgDelayMinutes).toBe(7);
    expect(report.buckets).toEqual([{ date: "2026-04-10", count: 1, avgDelay: 7 }]);
  });
});
