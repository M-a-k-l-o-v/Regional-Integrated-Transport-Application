"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessNodesIngestionService = void 0;
const client_1 = require("../infrastructure/orm/prisma/client");
const accessNodesNormaliser_1 = require("../ingestion/normalisers/accessNodesNormaliser");
class AccessNodesIngestionService {
    client;
    repo;
    constructor(client, repo) {
        this.client = client;
        this.repo = repo;
    }
    async ingestAccessNodes(sourceId, atcoAreaCodes) {
        await client_1.prisma.dataSource.upsert({
            where: { sourceId },
            update: { enabled: true },
            create: { sourceId, name: "DfT NaPTAN API", baseUrl: process.env.NAPTAN_API_BASE_URL ?? null, enabled: true },
        });
        const run = await client_1.prisma.jobRun.create({
            data: { jobName: "ingestAccessNodes", sourceId, status: "SUCCESS", recordsProcessed: 0 },
        });
        try {
            const csv = await this.client.fetchAccessNodesCsv(atcoAreaCodes);
            // Debug once: print header so we can lock mapping
            console.log("[access-nodes] header:", csv.split("\n")[0]);
            const nodes = (0, accessNodesNormaliser_1.normaliseAccessNodes)(csv);
            const n = await this.repo.upsertMany(nodes);
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
exports.AccessNodesIngestionService = AccessNodesIngestionService;
