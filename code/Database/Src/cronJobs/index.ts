import cron from "node-cron";
import { NptgClient } from "../infrastructure/apiClients/NptgClient";
import { LocalityRepository } from "../infrastructure/repositories/LocalityRepository";
import { LocalitiesIngestionService } from "../services/LocalitiesIngestionService";
import { AccessNodesClient } from "../infrastructure/apiClients/AccessNodesClient";
import { AccessNodeRepository } from "../infrastructure/repositories/AccessNodeRepository";
import { AccessNodesIngestionService } from "../services/AccessNodesIngestionService";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";
import { RailIngestionService } from "../services/RailIngestionService";
import { env } from "../config/env";

export function startCronJobs() {
  const baseUrl = env.NAPTAN_API_BASE_URL;

  const client = new NptgClient(baseUrl);
  const repo = new LocalityRepository();
  const service = new LocalitiesIngestionService(client, repo);
  const accessClient = new AccessNodesClient(baseUrl);
  const accessRepo = new AccessNodeRepository();
  const accessService = new AccessNodesIngestionService(accessClient, accessRepo);
  const railClient = new RailTimetableClient(env.RAIL_TIMETABLE_PATH);
  const railService = new RailIngestionService(railClient);

  // Localities are effectively static; run weekly.
  cron.schedule("0 2 * * 0", async () => {
    try {
      const localitiesCount = await service.ingestLocalities("naptan-nptg");
      console.log(`[cron] localities ingested: ${localitiesCount}`);
    } catch (e) {
      console.error("[cron] localities ingestion failed:", e);
    }
  });

  // Access nodes change infrequently; daily is sufficient.
  cron.schedule("10 2 * * *", async () => {
    try {
      const accessNodesCount = await accessService.ingestAccessNodes(
        "naptan-access-nodes",
        ["250"]
      );
      console.log(`[cron] access nodes ingested: ${accessNodesCount}`);
    } catch (e) {
      console.error("[cron] access nodes ingestion failed:", e);
    }
  });

  // Rail timetable refresh daily from the local timetable file path.
  cron.schedule("0 3 * * *", async () => {
    await railService.ingestRailRoutes("rail_timetable");
  });

  console.log("Cron jobs started.");
}
