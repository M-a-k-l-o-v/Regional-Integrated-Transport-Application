import type { PrismaClient } from "@prisma/client";

export type ScheduledRailDeparture = {
  scheduleId: string;
  trainUid: string;
  stationId: string | null;
  publicDeparture: string | null;
};

/**
 * Data-access surface for route verification. Isolates the Prisma queries
 * used to fetch the stored-schedule view of a service, which the
 * RouteVerificationService then cross-references against live upstream data.
 */
export class VerificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Load the scheduled rail departure for a given schedule + CRS. */
  async findScheduledRailDeparture(
    scheduleId: string,
    crs: string
  ): Promise<ScheduledRailDeparture | null> {
    const stop = await this.prisma.railServiceStop.findFirst({
      where: { scheduleId, stationId: crs },
      select: {
        scheduleId: true,
        publicDeparture: true,
        stationId: true,
        schedule: { select: { trainUid: true } },
      },
    });

    if (!stop) return null;
    return {
      scheduleId: stop.scheduleId,
      trainUid: stop.schedule.trainUid,
      stationId: stop.stationId,
      publicDeparture: stop.publicDeparture,
    };
  }
}
