import "dotenv/config";
import { prisma } from "../infrastructure/orm/prisma/client";

async function main() {
  // Transport server (legacy / API-based sources)
  await prisma.dataSource.upsert({
    where: { sourceId: "transport-server" },
    update: { enabled: true },
    create: {
      sourceId: "transport-server",
      name: "Transport SCC Server",
      baseUrl: process.env.TRANSPORT_SERVER_BASE_URL ?? null,
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

  console.log("Seeded DataSources: transport-server, rail_timetable");
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());