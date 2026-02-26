import fs from "node:fs";
import path from "node:path";
import { prisma } from "../infrastructure/orm/prisma/client";
import { JobStatus, TransportMode } from "@prisma/client";
import { XMLParser } from "fast-xml-parser";

type IngestBusOptions = {
  serviceDate: Date;          // date you want schedules generated for
  keepContextStops?: number;  // default 2
  lancashireOnly?: boolean;   // default true
};

function asArray<T>(x: any): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

// TransXChange often uses PT#H#M#S
function durationToSeconds(d: string | undefined): number {
  if (!d) return 0;
  // Handles "PT5M", "PT1H2M30S"
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

function timeToDate(serviceDate: Date, hhmmss: string): Date {
  // hh:mm:ss or hh:mm
  const [h, m, s] = hhmmss.split(":").map(Number);
  const d = new Date(serviceDate);
  d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
  return d;
}

export class BusTimetableIngestionService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // TransXChange files commonly use a default namespace; strip prefixes so keys are stable.
    removeNSPrefix: true,
  });

  async ingestTransXChangeFile(sourceId: string, filePath: string, opts: IngestBusOptions) {
    const keepN = opts.keepContextStops ?? 2;
    const lancashireOnly = opts.lancashireOnly ?? true;

    // Ensure DataSource exists
    await prisma.dataSource.upsert({
      where: { sourceId },
      update: { enabled: true },
      create: { sourceId, name: "BODS / TransXChange", baseUrl: null, enabled: true },
    });

    const run = await prisma.jobRun.create({
      data: { jobName: "ingestBusTimetable", sourceId, status: JobStatus.PARTIAL, recordsProcessed: 0 },
    });

    try {
      const xml = fs.readFileSync(filePath, "utf8");
      const doc = this.parser.parse(xml);

      // Root may be TransXChange or have namespace; this is “good enough” for most files.
      const txc = doc.TransXChange ?? doc;

      // -------- Operator + Route identity (best-effort, stable) --------
      // We’ll do a pragmatic stable route key:
      // routeId = "bus:<OperatorNameOrNoc>:<LineNameOrServiceCode>"
      const operators = asArray<any>(txc.Operators?.Operator);
      const operator = operators[0] ?? {};
      const operatorName =
        operator.OperatorName ?? operator.TradingName ?? operator.LicensedOperator?.["@_name"] ?? "Unknown Operator";
      const noc =
        asArray<any>(operator.NationalOperatorCode)[0] ??
        operator.NationalOperatorCode ??
        operator.LicensedOperator?.NationalOperatorCode ??
        "UNKNOWN";

      const operatorId = String(noc);

      await prisma.operator.upsert({
        where: { operatorId },
        update: { name: operatorName },
        create: { operatorId, name: operatorName },
      });

      const services = asArray<any>(txc.Services?.Service);
      if (services.length === 0) {
        console.log("[bus] no Services found in", path.basename(filePath));
        await prisma.jobRun.update({
          where: { jobRunId: run.jobRunId },
          data: { finishedAt: new Date(), status: JobStatus.SUCCESS, recordsProcessed: 0 },
        });
        return;
      }

      // -------- Build StopPointRef -> ATCO lookup (many TXC use AtcoCode as ref directly) --------
      // If your file has <StopPoints> inside TransXChange it may define StopPoint ids.
      // But in practice StopPointRef usually *is* ATCO (e.g. 2500....).
      // We’ll treat StopPointRef as stopId and rely on BusStop already existing.
      // (If later you find it’s not ATCO, we’ll add a mapping here.)

      let totalInserted = 0;

      for (const svc of services) {
        const lineName = svc.Lines?.Line?.LineName ?? svc.Lines?.Line?.LinePublicName ?? "UNKNOWN_LINE";
        const serviceCode = svc.ServiceCode ?? svc["@_id"] ?? lineName;

        const routeId = `bus:${operatorId}:${String(serviceCode)}`;

        await prisma.route.upsert({
          where: { routeId },
          update: { mode: TransportMode.BUS, operatorId },
          create: { routeId, mode: TransportMode.BUS, operatorId },
        });

        // -------- Stop order from JourneyPatternSections --------
        // We’ll extract an ordered list using the TimingLinks
        const jpSections = asArray<any>(txc.JourneyPatternSections?.JourneyPatternSection);
        const timingLinks: any[] = [];
        for (const sec of jpSections) {
          for (const link of asArray<any>(sec.JourneyPatternTimingLink)) timingLinks.push(link);
        }

        // Build a stop chain: first From + each To
        // Each link has From.StopPointRef and To.StopPointRef
        const chain: string[] = [];
        for (const link of timingLinks) {
          const fromRef = link.From?.StopPointRef;
          const toRef = link.To?.StopPointRef;
          if (!fromRef || !toRef) continue;
          if (chain.length === 0) chain.push(String(fromRef));
          if (chain[chain.length - 1] !== String(toRef)) chain.push(String(toRef));
        }

        if (chain.length === 0) continue;

        // -------- Lancashire filter + keep 2 stops context --------
        let keptChain = chain;

        if (lancashireOnly) {
          const inCovIdx = chain
            .map((stopId, idx) => ({ stopId, idx }))
            .filter(x => x.stopId.startsWith("250")); // Lancashire ATCO area

          if (inCovIdx.length === 0) {
            // skip route completely
            continue;
          }

          const first = inCovIdx[0].idx;
          const last = inCovIdx[inCovIdx.length - 1].idx;
          const a = Math.max(0, first - keepN);
          const b = Math.min(chain.length - 1, last + keepN);
          keptChain = chain.slice(a, b + 1);
        }

        // -------- Upsert BusRouteStop stop order --------
        // Wipe existing mapping for this route then recreate (simple + consistent)
        await prisma.busRouteStop.deleteMany({ where: { routeId } });

        // Only insert stops that exist in BusStop (avoid FK failures)
        const existing = await prisma.busStop.findMany({
          where: { stopId: { in: keptChain } },
          select: { stopId: true },
        });
        const existingSet = new Set(existing.map(x => x.stopId));
        const routeStopsToInsert = keptChain
          .filter(s => existingSet.has(s))
          .map((stopId, i) => ({ routeId, stopId, stopOrder: i }));

        await prisma.busRouteStop.createMany({ data: routeStopsToInsert, skipDuplicates: true });

        // -------- Build per-journey schedule times (MVP) --------
        // We derive times by:
        // VehicleJourney.DepartureTime = start time at first stop
        // + sum of RunTime + WaitTime along the timing links.
        const vehicleJourneys = asArray<any>(txc.VehicleJourneys?.VehicleJourney);

        // Delete schedules for this route on that day (MVP “daily rebuild”)
        const dayStart = new Date(opts.serviceDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        await prisma.busSchedule.deleteMany({
          where: {
            routeId,
            departureTime: { gte: dayStart, lt: dayEnd },
          },
        });

        // Precompute incremental seconds along the keptChain using timingLinks
        // Map link from->to to duration seconds
        const linkSeconds = new Map<string, number>();
        for (const link of timingLinks) {
          const fromRef = String(link.From?.StopPointRef ?? "");
          const toRef = String(link.To?.StopPointRef ?? "");
          if (!fromRef || !toRef) continue;
          const run = durationToSeconds(link.RunTime);
          const wait = durationToSeconds(link.WaitTime);
          linkSeconds.set(`${fromRef}__${toRef}`, run + wait);
        }

        // Build offsets along keptChain (seconds from first stop)
        const offsets: number[] = [0];
        for (let i = 1; i < keptChain.length; i++) {
          const prev = keptChain[i - 1];
          const cur = keptChain[i];
          const sec = linkSeconds.get(`${prev}__${cur}`) ?? 0;
          offsets[i] = offsets[i - 1] + sec;
        }

        const scheduleRows: Array<{
          routeId: string;
          stopId: string;
          arrivalTime: Date;
          departureTime: Date;
        }> = [];

        for (const vj of vehicleJourneys) {
          const dep = vj.DepartureTime;
          if (!dep) continue;

          const start = timeToDate(opts.serviceDate, String(dep));
          // Only emit for stops that exist in DB
          for (let i = 0; i < keptChain.length; i++) {
            const stopId = keptChain[i];
            if (!existingSet.has(stopId)) continue;

            const t = new Date(start.getTime() + offsets[i] * 1000);
            scheduleRows.push({
              routeId,
              stopId,
              arrivalTime: t,
              departureTime: t,
            });
          }
        }

        // Insert in chunks to avoid huge queries
        const CHUNK = 5000;
        for (let i = 0; i < scheduleRows.length; i += CHUNK) {
          const chunk = scheduleRows.slice(i, i + CHUNK);
          await prisma.busSchedule.createMany({ data: chunk });
          totalInserted += chunk.length;
        }
      }

      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: JobStatus.SUCCESS, recordsProcessed: totalInserted },
      });

      console.log("[bus] done:", { file: path.basename(filePath), inserted: totalInserted });
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: JobStatus.FAILED, errorMessage: String(err?.message ?? err) },
      });
      throw err;
    }
  }
}