"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localitiesIngestionJob = localitiesIngestionJob;
const NptgClient_1 = require("../infrastructure/apiClients/NptgClient");
const LocalityRepository_1 = require("../infrastructure/repositories/LocalityRepository");
const LocalitiesIngestionService_1 = require("../services/LocalitiesIngestionService");
/**
 * Ingestion job for NPTG localities (CSV).
 * This job fetches the latest localities dataset via the NaPTAN/NPTG API,
 * normalises it, and upserts into PostgreSQL.
 */
async function localitiesIngestionJob() {
    const baseUrl = process.env.TRANSPORT_SERVER_BASE_URL;
    if (!baseUrl) {
        throw new Error("Missing TRANSPORT_SERVER_BASE_URL in environment");
    }
    const client = new NptgClient_1.NptgClient(baseUrl);
    const repo = new LocalityRepository_1.LocalityRepository();
    const ingestion = new LocalitiesIngestionService_1.LocalitiesIngestionService(client, repo);
    const upserted = await ingestion.ingestLocalities("naptan-nptg");
    console.log(`[LocalitiesIngestionJob] Upserted localities: ${upserted}`);
}
