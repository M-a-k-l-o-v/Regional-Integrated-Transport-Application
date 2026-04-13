import "dotenv/config";
import { prisma } from "../infrastructure/orm/prisma/client";
import { env } from "../config/env";

async function main() {
  // Transport server (legacy / API-based sources)
  await prisma.dataSource.upsert({
    where: { sourceId: "transport-server" },
    update: { enabled: true },
    create: {
      sourceId: "transport-server",
      name: "Transport SCC Server",
      baseUrl: env.TRANSPORT_SERVER_BASE_URL,
      enabled: true,
    },
  });

  await prisma.dataSource.upsert({
    where: { sourceId: "weather" },
    update: { enabled: true },
    create: {
      sourceId: "weather",
      name: "Transport SCC Weather",
      baseUrl: `${env.TRANSPORT_SERVER_BASE_URL}/weather`,
      enabled: true,
    },
  });

  await prisma.dataSource.upsert({
    where: { sourceId: "rail_live_departures" },
    update: { enabled: true },
    create: {
      sourceId: "rail_live_departures",
      name: "Transport SCC Rail Live Departures",
      baseUrl: `${env.TRANSPORT_SERVER_BASE_URL}/rail/departures`,
      enabled: true,
    },
  });

  await prisma.dataSource.upsert({
    where: { sourceId: "bus_live_positions" },
    update: { enabled: true },
    create: {
      sourceId: "bus_live_positions",
      name: "Transport SCC Bus Live Positions",
      baseUrl: `${env.TRANSPORT_SERVER_BASE_URL}/bus/live`,
      enabled: true,
    },
  });

  // Rail timetable (local NDJSON ingestion)
  await prisma.dataSource.upsert({
    where: { sourceId: "rail_timetable" },
    update: { enabled: true },
    create: {
      sourceId: "rail_timetable",
      name: "Rail Timetable (NDJSON)",
      baseUrl: null,
      enabled: true,
    },
  });

  console.log(
    "Seeded DataSources: transport-server, weather, rail_live_departures, bus_live_positions, rail_timetable"
  );
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
