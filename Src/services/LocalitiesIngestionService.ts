import crypto from "crypto";
import { prisma } from "../infrastructure/orm/prisma/client";
import { NptgClient } from "../infrastructure/apiClients/NptgClient";
import { LocalityRepository } from "../infrastructure/repositories/LocalityRepository";
import { normaliseLocalities } from "../ingestion/normalisers/localitiesNormaliser";

export class LocalitiesIngestionService {
  constructor(
    private readonly client: NptgClient,
    private readonly repo: LocalityRepository
  ) {}

  async ingestLocalities(sourceId: string): Promise<number> {
    // self-heal datasource so FK never fails
    await prisma.dataSource.upsert({
      where: { sourceId },
      update: { enabled: true },
      create: { sourceId, name: "NaPTAN/NPTG API", baseUrl: process.env.TRANSPORT_SERVER_BASE_URL ?? null, enabled: true },
    });

    const run = await prisma.jobRun.create({
      data: { jobName: "ingestLocalities", sourceId, status: "SUCCESS", recordsProcessed: 0 },
    });

    try {
      const csv = await this.client.fetchLocalitiesCsv();
      /* ===== CHANGE DETECTION (DATASET HASHING) START ===== */
      const hash = crypto
        .createHash("sha256")
        .update(csv)
        .digest("hex");

      const existingSource = await prisma.dataSource.findUnique({
        where: { sourceId },
      });

      if (existingSource?.lastPayloadHash === hash) {
        console.log("[localities] no changes detected, skipping ingestion.");

        await prisma.jobRun.update({
          where: { jobRunId: run.jobRunId },
          data: {
            finishedAt: new Date(),
            status: "SUCCESS",
            recordsProcessed: 0,
          },
        });

        return 0;
      }
      /* ===== CHANGE DETECTION (DATASET HASHING) END ===== */
      console.log("[localities] header:", csv.split("\n")[0]);
      const localities = normaliseLocalities(csv);
      const n = await this.repo.upsertMany(localities);

      /* ===== UPDATE STORED HASH AFTER SUCCESSFUL INGESTION ===== */
      await prisma.dataSource.update({
        where: { sourceId },
        data: { lastPayloadHash: hash },
      });
      /* ===== END HASH UPDATE ===== */

      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: n > 0 ? "SUCCESS" : "PARTIAL", recordsProcessed: n },
      });

      return n;
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: "FAILED", errorMessage: String(err?.message ?? err) },
      });
      throw err;
    }
  }
}