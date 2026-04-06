import Redis from "ioredis";
import { env } from "../../config/env";

let client: Redis | null = null;
let connectionFailed = false;

function getClient(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (connectionFailed) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    client.on("error", () => {
      connectionFailed = true;
      client = null;
    });
  }
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch {
    // Ignore cache write failures — app continues without caching
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Ignore
  }
}
