import "dotenv/config";
import { prisma } from "../infrastructure/orm/prisma/client";

async function main() {
  // Update stops where:
  // RailServiceStop.tiploc -> RailTiploc.crsCode exists
  // and Station(stationId=crsCode) exists

  const tiplocs = await prisma.railTiploc.findMany({
    where: { crsCode: { not: null } },
    select: { tiplocCode: true, crsCode: true },
  });

  // Build a map TIPLOC -> CRS
  const map = new Map<string, string>();
  for (const t of tiplocs) {
    const crs = t.crsCode!.trim();
    if (crs) map.set(t.tiplocCode, crs);
  }

  let updated = 0;

  // Chunk through stops so we don’t blow memory
  const stops = await prisma.railServiceStop.findMany({
    where: { stationId: null },
    select: { stopId: true, tiplocCode: true },
  });

  for (const s of stops) {
    const crs = map.get(s.tiplocCode);
    if (!crs) continue;

    await prisma.railServiceStop.update({
      where: { stopId: s.stopId },
      data: { stationId: crs },
    });

    updated++;
  }

  console.log(`[rail] mapped stops to stations: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());