import { prisma } from "../infrastructure/orm/prisma/client";
import { RailTimetableClient } from "../infrastructure/apiClients/RailTimetableClient";

/**
 * Coverage set for filtering schedules.
 * NOTE: keep this here for now; we can move it to a dedicated module later.
 */
const COVERAGE_CRS = new Set<string>([
  // Lancashire
  "ACR","ADL","AFV","APB","AUG","BMB","BAR","BES","BBN","BPN","BPB","BPS","BRF","BSV",
  "BUB","BNC","BYM","BCB","BCJ","CNF","CYT","CRL","CTW","CLH","CNE","CSO","DWN","ENT",
  "EBA","HPN","HHB","HSC","HCT","KKM","LAN","LHO","LAY","LEY","LOH","LTM","MLH","MCM",
  "MOS","NEL","NLN","OMS","PBL","PLS","PFY","PRE","RGW","RIS","RSG","RUF","SLW","SVR",
  "SQU","SAS","TWN","UPL","WNN","WHE",

  // Manchester corridor (tight set)
  "MAN","MCV","MCO","DGT","SPT","MIA","BON","BLK","HWI","WGN","WGW","ATN",

  // Liverpool / Merseyside corridor (filtered)
  "LIV","LVC","MRF","LVJ","LPY","EDG","WAV","BGE","ROB","HUY","PSC","WHN","ECL","RNH",
  "LEG","SNH","THH","GSW","SHJ","ERL","NLW","HNX",
]);

const isInCoverage = (crs?: string | null) => !!crs && COVERAGE_CRS.has(crs);

// Keep 1–2 stops before/after for context
const CONTEXT_STOPS = 2;

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

  async ingestRailRoutes(
    sourceId: string,
    opts: { maxLines?: number; startLine?: number } = {}
  ): Promise<{ tiplocs: number; schedules: number; stops: number; skippedSchedules: number }> {
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
        status: "PARTIAL", // running / in-progress (we finalize to SUCCESS or FAILED at the end)
        recordsProcessed: 0,
      },
    });

    let tiplocs = 0;
    let schedules = 0;
    let stops = 0;
    let skippedSchedules = 0;

    // In-memory TIPLOC -> CRS cache to avoid DB lookups per schedule
    const tiplocToCrs = new Map<string, string | null>();

    try {
      for await (const line of this.client.fetchDailyTimetableLines({ maxLines: opts.maxLines, startLine: opts.startLine })) {
        const obj = JSON.parse(line);

        if (obj.TiplocV1) {
          const t: TiplocV1 = obj.TiplocV1;
          // Update cache so schedules can be filtered without DB queries
          tiplocToCrs.set(t.tiploc_code, (t.crs_code ?? null) as any);
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

          // --- COVERAGE FILTERING (Lancashire + corridor) ---
          // We keep only schedules that touch at least one in-coverage CRS.
          // Then we keep only the stop slice from (firstInCoverage - CONTEXT_STOPS)
          // to (lastInCoverage + CONTEXT_STOPS) for context.

          // Determine which stop indices map to a coverage CRS.
          const inCoverageIdx: number[] = [];
          for (let i = 0; i < locs.length; i++) {
            const tip = locs[i].tiploc_code;
            const crs = tiplocToCrs.get(tip) ?? null;
            if (isInCoverage(crs)) inCoverageIdx.push(i);
          }

          if (inCoverageIdx.length === 0) {
            skippedSchedules++;
            continue;
          }

          const first = inCoverageIdx[0];
          const last = inCoverageIdx[inCoverageIdx.length - 1];
          const fromIdx = Math.max(0, first - CONTEXT_STOPS);
          const toIdx = Math.min(locs.length - 1, last + CONTEXT_STOPS);

          const filteredLocs = locs.slice(fromIdx, toIdx + 1);
          // --- END COVERAGE FILTERING ---

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
          const tiplocCodes = Array.from(new Set(filteredLocs.map((x) => x.tiploc_code)));
          await prisma.railTiploc.createMany({
            data: tiplocCodes.map((code) => ({ tiplocCode: code })),
            skipDuplicates: true,
          });

          // Replace stops for this schedule (idempotent ingestion)
          await prisma.railServiceStop.deleteMany({ where: { scheduleId: upserted.scheduleId } });

          await prisma.railServiceStop.createMany({
            data: filteredLocs.map((loc, idx) => ({
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

          stops += filteredLocs.length;
          continue;
        }

        // Ignore JsonTimetableV1 and other record types for now
      }

      await prisma.jobRun.update({
        where: { jobRunId: job.jobRunId },
        data: {
          status: "SUCCESS",
          recordsProcessed: tiplocs + schedules + stops,
          finishedAt: new Date(),
        },
      });

      return { tiplocs, schedules, stops, skippedSchedules };
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: job.jobRunId },
        data: { status: "FAILED", errorMessage: String(err?.message ?? err), finishedAt: new Date() },
      });
      throw err;
    }
  }
}