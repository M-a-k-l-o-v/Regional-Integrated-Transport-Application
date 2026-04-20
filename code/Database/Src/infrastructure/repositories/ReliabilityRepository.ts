import type { PrismaClient } from "@prisma/client";

export type DelaySample = {
  timetableVariationMinutes: number;
  receivedAt: Date;
};

/**
 * Narrow data-access layer for reliability reporting. Services consume this
 * interface rather than touching Prisma directly, so the underlying store can
 * change without rippling through business logic (Dependency Inversion).
 */
export class ReliabilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findDepartureDelays(stanox: string, since: Date): Promise<DelaySample[]> {
    const rows = await this.prisma.railMovementLog.findMany({
      where: {
        stanox,
        eventType: "DEPARTURE",
        receivedAt: { gte: since },
        timetableVariationMinutes: { not: null },
      },
      select: { timetableVariationMinutes: true, receivedAt: true },
      orderBy: { receivedAt: "asc" },
    });

    return rows
      .filter((row): row is { timetableVariationMinutes: number; receivedAt: Date } =>
        row.timetableVariationMinutes !== null
      )
      .map((row) => ({
        timetableVariationMinutes: row.timetableVariationMinutes,
        receivedAt: row.receivedAt,
      }));
  }
}
