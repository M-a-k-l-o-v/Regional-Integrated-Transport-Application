import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./infrastructure/orm/prisma/client";
import { startCronJobs } from "./cronJobs";
import { RailLiveStreamService } from "./services/liveRail/RailLiveStreamService";
import { LiveMovementStore } from "./infrastructure/liveData/LiveMovementStore";
import { BusLiveDelayStore } from "./infrastructure/liveData/BusLiveDelayStore";
import { RailMovementLogger } from "./infrastructure/liveData/RailMovementLogger";
import { TransportServerClient } from "./infrastructure/apiClients/TransportServerClient";
import cron from "node-cron";
import { isInLancashire } from "./infrastructure/geography";
import { setStandLabelCache } from "./services/busStopGroups";

// Known Lancashire bus operator references for SIRI-VM polling
const BUS_LIVE_OPERATOR_REFS = ["LNCS", "PC", "ANW", "GONW"];

async function main() {
  // Confirm DB connectivity early
  await prisma.$connect();

  // ── Populate bus stop stand labels from NaPTAN indicator field ─────────────
  const stopsWithIndicator = await prisma.$queryRaw<Array<{ stopId: string; indicator: string }>>`
    SELECT "stopId", "indicator" FROM "BusStop" WHERE "indicator" IS NOT NULL
  `;
  setStandLabelCache(new Map(stopsWithIndicator.map((s) => [s.stopId, s.indicator])));

  // ── Rail live movement store (STOMP) ──────────────────────────────────────
  const liveMovementStore = new LiveMovementStore();
  const railMovementLogger = new RailMovementLogger(prisma);
  cron.schedule("*/10 * * * *", () => liveMovementStore.evictExpired());

  const railLiveStream = new RailLiveStreamService({
    enabled: env.NETWORK_RAIL_STOMP_ENABLED,
    host: env.NETWORK_RAIL_STOMP_HOST,
    port: env.NETWORK_RAIL_STOMP_PORT,
    username: env.NETWORK_RAIL_STOMP_USERNAME,
    password: env.NETWORK_RAIL_STOMP_PASSWORD,
    topics: env.NETWORK_RAIL_STOMP_TOPICS as ("TRAIN_MVT_ALL_TOC" | "TD_ALL_SIG_AREA" | "VSTP_ALL")[],
    onMovement: (entry) => {
      liveMovementStore.record(entry);
      railMovementLogger.log(entry);
    },
  });
  railLiveStream.start();

  // ── Bus live delay store (SIRI-VM MonitoredCall polling) ─────────────────
  const busLiveDelayStore = new BusLiveDelayStore();
  const transportClient = new TransportServerClient(
    env.TRANSPORT_SERVER_BASE_URL,
    env.TRANSPORT_SERVER_TIMEOUT_MS,
  );

  async function pollBusDelays() {
    for (const operatorRef of BUS_LIVE_OPERATOR_REFS) {
      try {
        const snapshot = await transportClient.getBusLive(operatorRef);
        const now = Date.now();
        for (const vehicle of snapshot.vehicles) {
          if (vehicle.monitoredCallDelayMinutes === null) continue;
          // Reject vehicles outside Lancashire — the server ignores operatorRef
          if (!isInLancashire(vehicle.latitude, vehicle.longitude)) continue;
          const lineLabel =
            vehicle.publishedLineName?.trim() ||
            (vehicle.lineRef?.includes(":")
              ? (vehicle.lineRef.split(":").pop() ?? vehicle.lineRef)
              : vehicle.lineRef) ||
            null;
          if (!lineLabel || !vehicle.originAimedDepartureTime) continue;
          const originDate = new Date(vehicle.originAimedDepartureTime);
          if (Number.isNaN(originDate.getTime())) continue;
          const hh = String(originDate.getHours()).padStart(2, "0");
          const mm = String(originDate.getMinutes()).padStart(2, "0");
          busLiveDelayStore.record({
            lineLabel,
            originHHMM: `${hh}:${mm}`,
            delayMinutes: vehicle.monitoredCallDelayMinutes,
            recordedAtMs: now,
          });
        }
      } catch {
        // SIRI feed may be unavailable — fail silently
      }
    }
  }

  // Poll immediately at startup, then every 60 seconds
  void pollBusDelays();
  cron.schedule("* * * * *", () => {
    void pollBusDelays();
    busLiveDelayStore.evictExpired();
  });

  // ── HTTP app ──────────────────────────────────────────────────────────────
  const app = createApp({ liveMovementStore, busLiveDelayStore });

  startCronJobs();

  app.listen(env.PORT, () => {
    console.log(`Backend running on http://localhost:${env.PORT}`);
    if (env.NETWORK_RAIL_STOMP_ENABLED) {
      console.log(`STOMP live stream enabled → ${env.NETWORK_RAIL_STOMP_HOST}:${env.NETWORK_RAIL_STOMP_PORT}`);
    }
    if (env.REDIS_URL) {
      console.log("Redis cache enabled");
    }
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
