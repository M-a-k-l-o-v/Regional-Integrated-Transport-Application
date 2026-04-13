import { prisma } from "../infrastructure/orm/prisma/client";
import { AccessNodesClient } from "../infrastructure/apiClients/AccessNodesClient";
import { AccessNodeRepository } from "../infrastructure/repositories/AccessNodeRepository";
import { normaliseAccessNodes } from "../ingestion/normalisers/accessNodesNormaliser";
import crypto from "crypto";
import { JobStatus } from "@prisma/client";


export class AccessNodesIngestionService {
  constructor(
    private readonly client: AccessNodesClient,
    private readonly repo: AccessNodeRepository
  ) {}

  async ingestAccessNodes(sourceId: string, atcoAreaCodes: string[]): Promise<number> {
    await prisma.dataSource.upsert({
      where: { sourceId },
      update: { enabled: true },
      create: { sourceId, name: "DfT NaPTAN API", baseUrl: process.env.NAPTAN_API_BASE_URL ?? null, enabled: true },
    });

    const run = await prisma.jobRun.create({
      data: { jobName: "ingestAccessNodes", sourceId, status: JobStatus.PARTIAL, recordsProcessed: 0 },    
    });

    try {
      const csv = await this.client.fetchAccessNodesCsv(atcoAreaCodes);

      /* ===== CHANGE DETECTION (DATASET HASHING) START ===== */
      const hash = crypto
        .createHash("sha256")
        .update(csv)
        .digest("hex");

      /* ===== CHANGE BLOCK: Only fetch lastPayloadHash for change detection ===== */
      const existingSource = await prisma.dataSource.findUnique({
        where: { sourceId },
        select: { lastPayloadHash: true },
      });
      /* ===== END CHANGE BLOCK ===== */

      if (existingSource?.lastPayloadHash === hash) {
        console.log("[access-nodes] no changes detected, skipping ingestion.");

        await prisma.jobRun.update({
          where: { jobRunId: run.jobRunId },
          data: {
            finishedAt: new Date(),
            status: JobStatus.SUCCESS,
            recordsProcessed: 0,
          },
        });

        return 0;
      }
      /* ===== CHANGE DETECTION (DATASET HASHING) END ===== */

      // Debug once: print header so we can lock mapping
      console.log("[access-nodes] header:", csv.split("\n")[0]);

      const nodes = normaliseAccessNodes(csv);
      const n = await this.repo.upsertMany(nodes);

      /* ===== UPDATE STORED HASH AFTER SUCCESSFUL INGESTION ===== */
      await prisma.dataSource.update({
        where: { sourceId },
        data: { lastPayloadHash: hash },
      });
      /* ===== END HASH UPDATE ===== */

      /* ===== CHANGE BLOCK: Always mark job as SUCCESS after a completed run ===== */
      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: JobStatus.SUCCESS, recordsProcessed: n },
      });
      /* ===== END CHANGE BLOCK ===== */

      return n;
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: JobStatus.FAILED, errorMessage: String(err?.message ?? err) },
      });
      throw err;
    }
  }
}