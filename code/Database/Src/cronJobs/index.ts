import cron from "node-cron";
import { NptgClient } from "../infrastructure/apiClients/NptgClient";
import { LocalityRepository } from "../infrastructure/repositories/LocalityRepository";
import { LocalitiesIngestionService } from "../services/LocalitiesIngestionService";
import { AccessNodesClient } from "../infrastructure/apiClients/AccessNodesClient";
import { AccessNodeRepository } from "../infrastructure/repositories/AccessNodeRepository";
import { AccessNodesIngestionService } from "../services/AccessNodesIngestionService";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";
import { RailIngestionService } from "../services/RailIngestionService";
import { ApiIngestionService } from "../services/ApiIngestionService";
import { env } from "../config/env";

export function buildApiIngestionService(): ApiIngestionService {
  const baseUrl = env.NAPTAN_API_BASE_URL;

  const localities = new LocalitiesIngestionService(
    new NptgClient(baseUrl),
    new LocalityRepository()
  );
  const accessNodes = new AccessNodesIngestionService(
    new AccessNodesClient(baseUrl),
    new AccessNodeRepository()
  );
  const rail = new RailIngestionService(new RailTimetableClient(env.RAIL_TIMETABLE_PATH));

  return new ApiIngestionService(localities, accessNodes, rail);
}

export function startCronJobs(ingestion: ApiIngestionService = buildApiIngestionService()) {
  // Localities are effectively static; run weekly.
  cron.schedule("0 2 * * 0", async () => {
    try {
      const count = await ingestion.ingestLocalities();
      console.log(`[cron] localities ingested: ${count}`);
    } catch (e) {
      console.error("[cron] localities ingestion failed:", e);
    }
  });

  // Access nodes change infrequently; daily is sufficient.
  cron.schedule("10 2 * * *", async () => {
    try {
      const count = await ingestion.ingestAccessNodes(["250"]);
      console.log(`[cron] access nodes ingested: ${count}`);
    } catch (e) {
      console.error("[cron] access nodes ingestion failed:", e);
    }
  });

  // Rail timetable refresh daily from the local timetable file path.
  cron.schedule("0 3 * * *", async () => {
    try {
      await ingestion.ingestRail();
    } catch (e) {
      console.error("[cron] rail ingestion failed:", e);
    }
  });

  console.log("Cron jobs started.");
  return ingestion;
}
