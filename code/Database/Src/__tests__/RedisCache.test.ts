import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ioredis before importing the module under test
const mockGet = vi.fn();
const mockSetex = vi.fn();
const mockDel = vi.fn();
const mockOn = vi.fn();

vi.mock("ioredis", () => {
  // Must be a constructor-style function for `new Redis(...)` to work
  function MockRedis(this: Record<string, unknown>) {
    this.get = mockGet;
    this.setex = mockSetex;
    this.del = mockDel;
    this.on = mockOn;
  }
  return { default: MockRedis };
});

// Mock env to provide a REDIS_URL
vi.mock("../config/env", () => ({
  env: { REDIS_URL: "redis://localhost:6379" },
}));

// Static import — works because vi.mock is hoisted before imports
import { cacheGet, cacheSet } from "../infrastructure/cache/RedisCache";

describe("RedisCache", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetex.mockReset();
    mockDel.mockReset();
    mockOn.mockReset();
  });

  it("cacheGet returns the cached value when Redis responds", async () => {
    mockGet.mockResolvedValueOnce('{"result":42}');
    const result = await cacheGet("some:key");
    expect(result).toBe('{"result":42}');
  });

  it("cacheGet returns null when Redis returns null (cache miss)", async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await cacheGet("missing:key")).toBeNull();
  });

  it("cacheGet returns null and does not throw when Redis rejects", async () => {
    mockGet.mockRejectedValueOnce(new Error("connection refused"));
    await expect(cacheGet("broken:key")).resolves.toBeNull();
  });

  it("cacheSet calls setex with correct TTL", async () => {
    mockSetex.mockResolvedValueOnce("OK");
    await cacheSet("my:key", "hello", 300);
    expect(mockSetex).toHaveBeenCalledWith("my:key", 300, "hello");
  });

  it("cacheSet does not throw when Redis rejects", async () => {
    mockSetex.mockRejectedValueOnce(new Error("write failed"));
    await expect(cacheSet("x", "y", 60)).resolves.toBeUndefined();
  });
});
