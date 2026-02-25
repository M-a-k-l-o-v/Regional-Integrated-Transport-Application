"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const NptgClient_1 = require("../infrastructure/apiClients/NptgClient");
const LocalityRepository_1 = require("../infrastructure/repositories/LocalityRepository");
const LocalitiesIngestionService_1 = require("../services/LocalitiesIngestionService");
const AccessNodesClient_1 = require("../infrastructure/apiClients/AccessNodesClient");
const AccessNodeRepository_1 = require("../infrastructure/repositories/AccessNodeRepository");
const AccessNodesIngestionService_1 = require("../services/AccessNodesIngestionService");
function startCronJobs() {
    const baseUrl = process.env.NAPTAN_API_BASE_URL;
    if (!baseUrl)
        throw new Error("NAPTAN_API_BASE_URL missing");
    const client = new NptgClient_1.NptgClient(baseUrl);
    const repo = new LocalityRepository_1.LocalityRepository();
    const service = new LocalitiesIngestionService_1.LocalitiesIngestionService(client, repo);
    const accessClient = new AccessNodesClient_1.AccessNodesClient(baseUrl);
    const accessRepo = new AccessNodeRepository_1.AccessNodeRepository();
    const accessService = new AccessNodesIngestionService_1.AccessNodesIngestionService(accessClient, accessRepo);
    node_cron_1.default.schedule("* * * * *", async () => {
        try {
            const localitiesCount = await service.ingestLocalities("naptan-nptg");
            console.log(`[cron] localities ingested: ${localitiesCount}`);
        }
        catch (e) {
            console.error("[cron] localities ingestion failed:", e);
        }
    });
    node_cron_1.default.schedule("* * * * *", async () => {
        try {
            const accessNodesCount = await accessService.ingestAccessNodes("naptan-access-nodes", ["250"]);
            console.log(`[cron] access nodes ingested: ${accessNodesCount}`);
        }
        catch (e) {
            console.error("[cron] access nodes ingestion failed:", e);
        }
    });
    console.log("Cron jobs started.");
}
