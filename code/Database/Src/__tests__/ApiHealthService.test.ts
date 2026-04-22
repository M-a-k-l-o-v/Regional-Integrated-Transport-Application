import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("../infrastructure/cache/RedisCache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

vi.mock("../config/env", () => ({
  env: {
    REDIS_URL: "redis://localhost:6379",
    NETWORK_RAIL_STOMP_ENABLED: true,
    NETWORK_RAIL_STOMP_HOST: "broker.example.com",
  },
}));

import { ApiHealthService } from "../services/ApiHealthService";
import type { PrismaClient } from "@prisma/client";
import type { LiveMovementStore } from "../infrastructure/liveData/LiveMovementStore";
import type { BusLiveDelayStore } from "../infrastructure/liveData/BusLiveDelayStore";

function makePrisma(queryImpl: () => Promise<unknown>): PrismaClient {
  return {
    $queryRaw: vi.fn().mockImplementation(queryImpl),
  } as unknown as PrismaClient;
}

function makeLiveStore(size: number): LiveMovementStore {
  return { size } as unknown as LiveMovementStore;
}

describe("ApiHealthService", () => {
  beforeEach(() => {
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it("reports database ok with latencyMs when the query succeeds", async () => {
    const svc = new ApiHealthService(makePrisma(async () => [{ ok: 1 }]));
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue("123");

    const report = await svc.probe();
    expect(report.database.ok).toBe(true);
    if (report.database.ok) {
      expect(typeof report.database.latencyMs).toBe("number");
    }
  });

  it("reports database failure when the query throws", async () => {
    const svc = new ApiHealthService(
      makePrisma(async () => {
        throw new Error("connection refused");
      })
    );
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue("123");

    const report = await svc.probe();
    expect(report.database.ok).toBe(false);
    if (!report.database.ok) {
      expect(report.database.error).toBe("connection refused");
    }
  });

  it("reports redis ok when the probe round-trips successfully", async () => {
    const svc = new ApiHealthService(makePrisma(async () => [{ ok: 1 }]));
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue("abc");

    const report = await svc.probe();
    expect(report.redis.enabled).toBe(true);
    expect(report.redis.ok).toBe(true);
  });

  it("reports redis failure when the probe read returns null", async () => {
    const svc = new ApiHealthService(makePrisma(async () => [{ ok: 1 }]));
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue(null);

    const report = await svc.probe();
    expect(report.redis.ok).toBe(false);
    expect(report.redis.enabled).toBe(true);
  });

  it("reports redis failure when the cache client throws", async () => {
    const svc = new ApiHealthService(makePrisma(async () => [{ ok: 1 }]));
    mockCacheSet.mockRejectedValue(new Error("Redis ECONNREFUSED"));

    const report = await svc.probe();
    expect(report.redis.ok).toBe(false);
    if (!report.redis.ok) {
      expect(report.redis.error).toBe("Redis ECONNREFUSED");
    }
  });

  it("includes live store size and bus delay presence in the report", async () => {
    const busStore = {} as unknown as BusLiveDelayStore;
    const svc = new ApiHealthService(
      makePrisma(async () => [{ ok: 1 }]),
      makeLiveStore(42),
      busStore
    );
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue("x");

    const report = await svc.probe();
    expect(report.stomp.liveMovementEntries).toBe(42);
    expect(report.stomp.enabled).toBe(true);
    expect(report.stomp.host).toBe("broker.example.com");
    expect(report.busLiveDelayEntries).toBe("present");
  });

  it("marks bus delay entries as absent when no store is supplied", async () => {
    const svc = new ApiHealthService(makePrisma(async () => [{ ok: 1 }]));
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue("x");

    const report = await svc.probe();
    expect(report.busLiveDelayEntries).toBe("absent");
    expect(report.stomp.liveMovementEntries).toBe(0);
  });

  it("always produces the expected top-level shape", async () => {
    const svc = new ApiHealthService(makePrisma(async () => [{ ok: 1 }]));
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheGet.mockResolvedValue("x");

    const report = await svc.probe();
    expect(report.service).toBe("transitpredict-backend");
    expect(typeof report.timestamp).toBe("string");
    expect(typeof report.uptimeSeconds).toBe("number");
  });
});
