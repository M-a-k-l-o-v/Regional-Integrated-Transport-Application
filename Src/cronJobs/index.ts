import cron from "node-cron";
import { NptgClient } from "../infrastructure/apiClients/NptgClient";
import { LocalityRepository } from "../infrastructure/repositories/LocalityRepository";
import { LocalitiesIngestionService } from "../services/LocalitiesIngestionService";
import { AccessNodesClient } from "../infrastructure/apiClients/AccessNodesClient";
import { AccessNodeRepository } from "../infrastructure/repositories/AccessNodeRepository";
import { AccessNodesIngestionService } from "../services/AccessNodesIngestionService";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";
import { RailIngestionService } from "../services/RailIngestionService";



export function startCronJobs() {
  const baseUrl = process.env.NAPTAN_API_BASE_URL;
  if (!baseUrl) throw new Error("NAPTAN_API_BASE_URL missing");

  const client = new NptgClient(baseUrl);
  const repo = new LocalityRepository();
  const service = new LocalitiesIngestionService(client, repo);
  const accessClient = new AccessNodesClient(baseUrl);
  const accessRepo = new AccessNodeRepository();
  const accessService = new AccessNodesIngestionService(accessClient, accessRepo);
  const railClient = new RailTimetableClient(process.env.TRANSPORT_API_BASE!);
  const railService = new RailIngestionService(railClient);



  cron.schedule("* * * * *", async () => {
    try {
      const localitiesCount = await service.ingestLocalities("naptan-nptg");
      console.log(`[cron] localities ingested: ${localitiesCount}`);
    } catch (e) {
      console.error("[cron] localities ingestion failed:", e);
    }
  });

  cron.schedule("* * * * *", async () => {
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

  cron.schedule("0 * * * *", async () => {
    await railService.ingestRailRoutes("rail-timetable");
  });

  console.log("Cron jobs started.");
}