import crypto from "crypto";
import { prisma } from "../infrastructure/orm/prisma/client";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";

export class RailIngestionService {
  constructor(private readonly client: RailTimetableClient) {}

  async ingestRailRoutes(sourceId: string): Promise<number> {
    const run = await prisma.jobRun.create({
      data: {
        sourceId,
        jobName: "rail-timetable",
        status: "SUCCESS",
      },
    });

    try {
      const raw = await this.client.fetchDailyTimetable();

      /* ===== CHANGE DETECTION START ===== */
      const hash = crypto.createHash("sha256").update(raw).digest("hex");

      const existingSource = await prisma.dataSource.findUnique({
        where: { sourceId },
      });

      if (existingSource?.lastPayloadHash === hash) {
        console.log("[rail] no changes detected, skipping ingestion.");

        await prisma.jobRun.update({
          where: { jobRunId: run.jobRunId },
          data: {
            finishedAt: new Date(),
            recordsProcessed: 0,
          },
        });

        return 0;
      }
      /* ===== CHANGE DETECTION END ===== */

      // TODO: parse timetable here
      const parsedRoutes = this.parseTimetable(raw);

      // Example upsert logic (placeholder)
      for (const r of parsedRoutes) {
        await prisma.route.upsert({
          where: { routeId: r.routeId },
          update: { mode: "RAIL" },
          create: {
            routeId: r.routeId,
            mode: "RAIL",
          },
        });
      }

      await prisma.dataSource.update({
        where: { sourceId },
        data: { lastPayloadHash: hash },
      });

      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: {
          finishedAt: new Date(),
          recordsProcessed: parsedRoutes.length,
        },
      });

      return parsedRoutes.length;
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: {
          finishedAt: new Date(),
          status: "FAILED",
          errorMessage: err.message,
        },
      });

      throw err;
    }
  }

  private parseTimetable(raw: string) {
    // Temporary mock parser
    return [
      { routeId: "RAIL_001" },
      { routeId: "RAIL_002" },
    ];
  }
}