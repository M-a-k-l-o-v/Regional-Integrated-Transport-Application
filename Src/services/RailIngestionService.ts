import { prisma } from "../infrastructure/orm/prisma/client";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";

type TiplocV1 = {
  transaction_type?: string;
  tiploc_code: string;
  nalco?: string | null;
  stanox?: string | null;
  crs_code?: string | null;
  description?: string | null;
  tps_description?: string | null;
};

type ScheduleLocation = {
  location_type: "LO" | "LI" | "LT";
  record_identity?: string | null;
  tiploc_code: string;
  arrival?: string | null;
  public_arrival?: string | null;
  departure?: string | null;
  public_departure?: string | null;
  pass?: string | null;
  platform?: string | null;
  line?: string | null;
  path?: string | null;
  engineering_allowance?: string | null;
  pathing_allowance?: string | null;
  performance_allowance?: string | null;
};

type JsonScheduleV1 = {
  transaction_type?: string;
  CIF_train_uid: string;
  CIF_stp_indicator: string;
  atoc_code?: string | null;
  train_status?: string | null;
  schedule_days_runs: string;
  schedule_start_date: string; // YYYY-MM-DD
  schedule_end_date: string;   // YYYY-MM-DD
  schedule_segment?: {
    signalling_id?: string | null;
    CIF_train_category?: string | null;
    CIF_headcode?: string | null;
    CIF_train_service_code?: string | null;
    CIF_business_sector?: string | null;
    CIF_power_type?: string | null;
    CIF_timing_load?: string | null;
    CIF_speed?: string | null;
    CIF_operating_characteristics?: string | null;
    CIF_train_class?: string | null;
    CIF_sleepers?: string | null;
    CIF_reservations?: string | null;
    CIF_connection_indicator?: string | null;
    CIF_catering_code?: string | null;
    CIF_service_branding?: string | null;
    schedule_location?: ScheduleLocation[];
  } | null;
};

function dateOnlyToUtc(dateStr: string): Date {
  // dateStr like "2026-03-15"
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export class RailIngestionService {
  constructor(private readonly client: RailTimetableClient) {}

  async ingestRailRoutes(sourceId: string, maxLines?: number): Promise<{ tiplocs: number; schedules: number; stops: number }> {
    // Ensure FK will never fail
    await prisma.dataSource.upsert({
      where: { sourceId },
      update: {},
      create: { sourceId, name: sourceId, enabled: true },
    });

    const job = await prisma.jobRun.create({
      data: {
        jobName: "ingestRailTimetable",
        sourceId,
        status: "SUCCESS", // start optimistic; flip on error
        recordsProcessed: 0,
      },
    });

    let tiplocs = 0;
    let schedules = 0;
    let stops = 0;

    try {
      for await (const line of this.client.fetchDailyTimetableLines({ maxLines })) {
        const obj = JSON.parse(line);

        if (obj.TiplocV1) {
          const t: TiplocV1 = obj.TiplocV1;
          // Ignore deletes for now; most feeds are Create/Update heavy
          await prisma.railTiploc.upsert({
            where: { tiplocCode: t.tiploc_code },
            update: {
              nalco: t.nalco ?? null,
              stanox: t.stanox ?? null,
              crsCode: t.crs_code ?? null,
              description: t.description ?? null,
              tpsDescription: t.tps_description ?? null,
            },
            create: {
              tiplocCode: t.tiploc_code,
              nalco: t.nalco ?? null,
              stanox: t.stanox ?? null,
              crsCode: t.crs_code ?? null,
              description: t.description ?? null,
              tpsDescription: t.tps_description ?? null,
            },
          });
          tiplocs++;
          continue;
        }

        if (obj.JsonScheduleV1) {
          const s: JsonScheduleV1 = obj.JsonScheduleV1;

          // Some entries are "empty" / cancelled-like records (no locations)
          const locs = s.schedule_segment?.schedule_location ?? [];
          if (!locs.length) continue;

          const scheduleStartDate = dateOnlyToUtc(s.schedule_start_date);
          const scheduleEndDate = dateOnlyToUtc(s.schedule_end_date);

          const upserted = await prisma.railServiceSchedule.upsert({
            where: {
              trainUid_stpIndicator_scheduleStartDate_scheduleEndDate: {
                trainUid: s.CIF_train_uid,
                stpIndicator: s.CIF_stp_indicator,
                scheduleStartDate,
                scheduleEndDate,
              },
            },
            update: {
              atocCode: s.atoc_code ?? null,
              signallingId: s.schedule_segment?.signalling_id ?? null,
              scheduleDaysRuns: s.schedule_days_runs,
              trainStatus: s.train_status ?? null,

              trainCategory: s.schedule_segment?.CIF_train_category ?? null,
              headcode: s.schedule_segment?.CIF_headcode ?? null,
              serviceCode: s.schedule_segment?.CIF_train_service_code ?? null,
              businessSector: s.schedule_segment?.CIF_business_sector ?? null,
              powerType: s.schedule_segment?.CIF_power_type ?? null,
              timingLoad: s.schedule_segment?.CIF_timing_load ?? null,
              speed: s.schedule_segment?.CIF_speed ?? null,
              operatingCharacteristics: s.schedule_segment?.CIF_operating_characteristics ?? null,
              trainClass: s.schedule_segment?.CIF_train_class ?? null,
              sleepers: s.schedule_segment?.CIF_sleepers ?? null,
              reservations: s.schedule_segment?.CIF_reservations ?? null,
              connectionIndicator: s.schedule_segment?.CIF_connection_indicator ?? null,
              cateringCode: s.schedule_segment?.CIF_catering_code ?? null,
              serviceBranding: s.schedule_segment?.CIF_service_branding ?? null,
            },
            create: {
              trainUid: s.CIF_train_uid,
              stpIndicator: s.CIF_stp_indicator,
              atocCode: s.atoc_code ?? null,
              signallingId: s.schedule_segment?.signalling_id ?? null,

              scheduleStartDate,
              scheduleEndDate,
              scheduleDaysRuns: s.schedule_days_runs,
              trainStatus: s.train_status ?? null,

              trainCategory: s.schedule_segment?.CIF_train_category ?? null,
              headcode: s.schedule_segment?.CIF_headcode ?? null,
              serviceCode: s.schedule_segment?.CIF_train_service_code ?? null,
              businessSector: s.schedule_segment?.CIF_business_sector ?? null,
              powerType: s.schedule_segment?.CIF_power_type ?? null,
              timingLoad: s.schedule_segment?.CIF_timing_load ?? null,
              speed: s.schedule_segment?.CIF_speed ?? null,
              operatingCharacteristics: s.schedule_segment?.CIF_operating_characteristics ?? null,
              trainClass: s.schedule_segment?.CIF_train_class ?? null,
              sleepers: s.schedule_segment?.CIF_sleepers ?? null,
              reservations: s.schedule_segment?.CIF_reservations ?? null,
              connectionIndicator: s.schedule_segment?.CIF_connection_indicator ?? null,
              cateringCode: s.schedule_segment?.CIF_catering_code ?? null,
              serviceBranding: s.schedule_segment?.CIF_service_branding ?? null,
            },
          });

          schedules++;

          // Ensure TIPLOC rows exist for all stop locations (fast + avoids FK failures)
          const tiplocCodes = Array.from(new Set(locs.map((x) => x.tiploc_code)));
          await prisma.railTiploc.createMany({
            data: tiplocCodes.map((code) => ({ tiplocCode: code })),
            skipDuplicates: true,
          });

          // Replace stops for this schedule (idempotent ingestion)
          await prisma.railServiceStop.deleteMany({ where: { scheduleId: upserted.scheduleId } });

          await prisma.railServiceStop.createMany({
            data: locs.map((loc, idx) => ({
              scheduleId: upserted.scheduleId,
              stopSeq: idx,
              locationType: loc.location_type,
              recordIdentity: loc.record_identity ?? null,
              tiplocCode: loc.tiploc_code,

              arrival: loc.arrival ?? null,
              publicArrival: loc.public_arrival ?? null,
              departure: loc.departure ?? null,
              publicDeparture: loc.public_departure ?? null,
              pass: loc.pass ?? null,

              platform: loc.platform ?? null,
              line: loc.line ?? null,
              path: loc.path ?? null,

              engineeringAllowance: loc.engineering_allowance ?? null,
              pathingAllowance: loc.pathing_allowance ?? null,
              performanceAllowance: loc.performance_allowance ?? null,
            })),
          });

          stops += locs.length;
          continue;
        }

        // Ignore JsonTimetableV1 and other record types for now
      }

      await prisma.jobRun.update({
        where: { jobRunId: job.jobRunId },
        data: { status: "SUCCESS", recordsProcessed: tiplocs + schedules + stops, finishedAt: new Date() },
      });

      return { tiplocs, schedules, stops };
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: job.jobRunId },
        data: { status: "FAILED", errorMessage: String(err?.message ?? err), finishedAt: new Date() },
      });
      throw err;
    }
  }
}