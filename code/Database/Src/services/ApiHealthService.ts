import type { PrismaClient } from "@prisma/client";
import { cacheGet, cacheSet } from "../infrastructure/cache/RedisCache";
import { env } from "../config/env";
import type { LiveMovementStore } from "../infrastructure/liveData/LiveMovementStore";
import type { BusLiveDelayStore } from "../infrastructure/liveData/BusLiveDelayStore";

export type ComponentStatus =
  | { ok: true; latencyMs?: number }
  | { ok: false; error: string };

export type HealthReport = {
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database: ComponentStatus;
  redis: ComponentStatus & { enabled: boolean };
  stomp: {
    enabled: boolean;
    host: string | null;
    liveMovementEntries: number;
  };
  busLiveDelayEntries: "present" | "absent";
};

/**
 * Monitors the operational health of the API surface and its direct
 * dependencies. Isolated from route wiring so cron jobs, admin endpoints, and
 * tests can reuse the same probe (Single Responsibility Principle).
 */
export class ApiHealthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly liveMovementStore?: LiveMovementStore,
    private readonly busLiveDelayStore?: BusLiveDelayStore
  ) {}

  async probe(): Promise<HealthReport> {
    return {
      service: "transitpredict-backend",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: await this.probeDatabase(),
      redis: await this.probeRedis(),
      stomp: {
        enabled: env.NETWORK_RAIL_STOMP_ENABLED,
        host: env.NETWORK_RAIL_STOMP_ENABLED ? env.NETWORK_RAIL_STOMP_HOST : null,
        liveMovementEntries: this.liveMovementStore?.size ?? 0,
      },
      busLiveDelayEntries: this.busLiveDelayStore ? "present" : "absent",
    };
  }

  private async probeDatabase(): Promise<ComponentStatus> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Database query failed" };
    }
  }

  private async probeRedis(): Promise<ComponentStatus & { enabled: boolean }> {
    if (!env.REDIS_URL) {
      return { ok: false, enabled: false, error: "REDIS_URL not configured" };
    }
    const started = Date.now();
    try {
      const probeKey = "admin:probe";
      await cacheSet(probeKey, String(started), 5);
      const got = await cacheGet(probeKey);
      if (!got) {
        return { ok: false, enabled: true, error: "probe write succeeded but read returned null" };
      }
      return { ok: true, enabled: true, latencyMs: Date.now() - started };
    } catch (err) {
      return {
        ok: false,
        enabled: true,
        error: err instanceof Error ? err.message : "Redis probe failed",
      };
    }
  }
}
