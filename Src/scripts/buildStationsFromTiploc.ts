import "dotenv/config";
import { prisma } from "../infrastructure/orm/prisma/client";

async function main() {
  const tiplocs = await prisma.railTiploc.findMany({
    where: { crsCode: { not: null } },
    select: { crsCode: true, description: true, tpsDescription: true },
  });

  let upserted = 0;

  for (const t of tiplocs) {
    const crs = t.crsCode?.trim();
    if (!crs) continue;

    const name =
      (t.description && t.description.trim()) ||
      (t.tpsDescription && t.tpsDescription.trim()) ||
      crs;

    await prisma.station.upsert({
      where: { stationId: crs },
      update: { name },
      create: { stationId: crs, name },
    });

    upserted++;
  }

  console.log(`[stations] upserted: ${upserted}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());