import { prisma } from "../infrastructure/orm/prisma/client";
import { StationCoordinateBackfillService } from "../services/stations/StationCoordinateBackfillService";

async function main() {
  const args = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.split("=");
      return [key, value ?? "true"];
    })
  );

  const dryRun = args.get("--dryRun") === "true";
  const stationIds = (args.get("--stations") ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const service = new StationCoordinateBackfillService(prisma);
  const summary = await service.backfill({
    dryRun,
    stationIds: stationIds.length > 0 ? stationIds : undefined,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
