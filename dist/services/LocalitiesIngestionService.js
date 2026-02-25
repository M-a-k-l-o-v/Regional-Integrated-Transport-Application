"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalitiesIngestionService = void 0;
const client_1 = require("../infrastructure/orm/prisma/client");
const localitiesNormaliser_1 = require("../ingestion/normalisers/localitiesNormaliser");
class LocalitiesIngestionService {
    client;
    repo;
    constructor(client, repo) {
        this.client = client;
        this.repo = repo;
    }
    async ingestLocalities(sourceId) {
        // self-heal datasource so FK never fails
        await client_1.prisma.dataSource.upsert({
            where: { sourceId },
            update: { enabled: true },
            create: { sourceId, name: "NaPTAN/NPTG API", baseUrl: process.env.TRANSPORT_SERVER_BASE_URL ?? null, enabled: true },
        });
        const run = await client_1.prisma.jobRun.create({
            data: { jobName: "ingestLocalities", sourceId, status: "SUCCESS", recordsProcessed: 0 },
        });
        try {
            const csv = await this.client.fetchLocalitiesCsv();
            console.log("[localities] header:", csv.split("\n")[0]);
            const localities = (0, localitiesNormaliser_1.normaliseLocalities)(csv);
            const n = await this.repo.upsertMany(localities);
            await client_1.prisma.jobRun.update({
                where: { jobRunId: run.jobRunId },
                data: { finishedAt: new Date(), status: n > 0 ? "SUCCESS" : "PARTIAL", recordsProcessed: n },
            });
            return n;
        }
        catch (err) {
            await client_1.prisma.jobRun.update({
                where: { jobRunId: run.jobRunId },
                data: { finishedAt: new Date(), status: "FAILED", errorMessage: String(err?.message ?? err) },
            });
            throw err;
        }
    }
}
exports.LocalitiesIngestionService = LocalitiesIngestionService;
