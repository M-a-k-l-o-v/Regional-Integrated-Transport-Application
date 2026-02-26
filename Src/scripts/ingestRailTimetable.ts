import "dotenv/config";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";
import { RailIngestionService } from "../services/RailIngestionService";

function getArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}

async function main() {
  const filePath = process.env.RAIL_TIMETABLE_PATH;
  if (!filePath) throw new Error("RAIL_TIMETABLE_PATH is missing in .env");

  // Default matches your seeded DataSource id
  const sourceId = getArg("sourceId") ?? "rail_timetable";

  const maxLinesStr = getArg("maxLines");
  const maxLines = maxLinesStr ? Number(maxLinesStr) : undefined;

  const startLineStr = getArg("startLine");
  const startLine = startLineStr ? Number(startLineStr) : undefined;

  const client = new RailTimetableClient(filePath);
  const service = new RailIngestionService(client);

  const result = await service.ingestRailRoutes(sourceId, { maxLines, startLine });
  console.log("[rail] done:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});