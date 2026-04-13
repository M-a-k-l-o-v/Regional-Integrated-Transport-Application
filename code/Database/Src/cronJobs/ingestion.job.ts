
import { NptgClient } from "../infrastructure/apiClients/NptgClient";
import { LocalityRepository } from "../infrastructure/repositories/LocalityRepository";
import { LocalitiesIngestionService } from "../services/LocalitiesIngestionService";
import { env } from "../config/env";

/**
 * Ingestion job for NPTG localities (CSV).
 * This job fetches the latest localities dataset via the NaPTAN/NPTG API,
 * normalises it, and upserts into PostgreSQL.
 */
export async function localitiesIngestionJob() {
  const baseUrl = env.NAPTAN_API_BASE_URL;

  const client = new NptgClient(baseUrl);
  const repo = new LocalityRepository();
  const ingestion = new LocalitiesIngestionService(client, repo);

  const upserted = await ingestion.ingestLocalities("naptan-nptg");
  console.log(`[LocalitiesIngestionJob] Upserted localities: ${upserted}`);
}
