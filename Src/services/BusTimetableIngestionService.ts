import fs from "node:fs";
import path from "node:path";
import { SaxesParser, SaxesTag } from "saxes";
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

function escapeText(t: string): string {
  return t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function attrsToString(attrs: Record<string, any>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs ?? {})) {
    // saxes may provide { value } objects depending on configuration
    const val = v && typeof v === "object" && "value" in (v as any) ? (v as any).value : v;
    if (val === undefined || val === null) continue;
    const escaped = String(val)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    parts.push(`${k}="${escaped}"`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

type CapturedHeader = {
  operatorsXml?: string;
  servicesXml?: string;
  journeyPatternSectionsXml?: string;
};

async function captureHeaderSections(filePath: string): Promise<CapturedHeader> {
  if (!fs.existsSync(filePath)) throw new Error(`TXC file not found: ${filePath}`);

  const targets = new Set(["Operators", "Services", "JourneyPatternSections"]);
  const captured: CapturedHeader = {};

  const parser = new SaxesParser({ xmlns: false });
  const rs = fs.createReadStream(filePath, { encoding: "utf8" });

  let capturing: null | "Operators" | "Services" | "JourneyPatternSections" = null;
  let depth = 0;
  let buf = "";

  const maybeFinish = () => {
    if (captured.operatorsXml && captured.servicesXml && captured.journeyPatternSectionsXml) {
      // stop the stream early
      rs.destroy();
    }
  };

  parser.on("opentag", (tag: SaxesTag) => {
    const name = tag.name;

    if (!capturing && targets.has(name as any)) {
      capturing = name as any;
      depth = 1;
      buf = `<${name}${attrsToString(tag.attributes as any)}>`;
      return;
    }

    if (capturing) {
      depth++;
      buf += `<${name}${attrsToString(tag.attributes as any)}>`;
    }
  });

  parser.on("text", (t: string) => {
    if (!capturing) return;
    buf += escapeText(t);
  });

  parser.on("cdata", (t: string) => {
    if (!capturing) return;
    buf += `<![CDATA[${t}]]>`;
  });

  parser.on("closetag", (tag: any) => {
    if (!capturing) return;

    const name = typeof tag === "string" ? tag : tag?.name;
    if (!name) return;

    buf += `</${name}>`;
    depth--;

    if (depth === 0) {
      if (capturing === "Operators") captured.operatorsXml = buf;
      if (capturing === "Services") captured.servicesXml = buf;
      if (capturing === "JourneyPatternSections") captured.journeyPatternSectionsXml = buf;

      capturing = null;
      buf = "";
      maybeFinish();
    }
  });

  parser.on("error", (e) => {
    rs.destroy(e as any);
  });

  await new Promise<void>((resolve, reject) => {
    rs.on("data", (chunk) => parser.write(chunk));
    rs.on("end", () => resolve());
    rs.on("close", () => resolve());
    rs.on("error", reject);
  });

  try {
    parser.close();
  } catch {
    // ignore close errors if we destroyed early
  }

  return captured;
}

async function streamVehicleJourneys(
  filePath: string,
  onVehicleJourney: (vjXml: string) => Promise<void>
): Promise<void> {
  if (!fs.existsSync(filePath)) throw new Error(`TXC file not found: ${filePath}`);

  const parser = new SaxesParser({ xmlns: false });
  const rs = fs.createReadStream(filePath, { encoding: "utf8" });

  let inVJ = false;
  let vjDepth = 0;
  let buf = "";

  // backpressure: chain handlers so we never buffer an unbounded queue
  let pending: Promise<void> = Promise.resolve();
  const chain = (p: Promise<void>) => (pending = pending.then(() => p));

  parser.on("opentag", (tag: SaxesTag) => {
    const name = tag.name;

    if (name === "VehicleJourney") {
      inVJ = true;
      vjDepth = 1;
      buf = `<${name}${attrsToString(tag.attributes as any)}>`;
      return;
    }

    if (inVJ) {
      vjDepth++;
      buf += `<${name}${attrsToString(tag.attributes as any)}>`;
    }
  });

  parser.on("text", (t: string) => {
    if (!inVJ) return;
    buf += escapeText(t);
  });

  parser.on("cdata", (t: string) => {
    if (!inVJ) return;
    buf += `<![CDATA[${t}]]>`;
  });

  parser.on("closetag", (tag: any) => {
    if (!inVJ) return;

    const name = typeof tag === "string" ? tag : tag?.name;
    if (!name) return;

    buf += `</${name}>`;
    vjDepth--;

    if (name === "VehicleJourney" && vjDepth === 0) {
      const vjXml = buf;
      inVJ = false;
      buf = "";

      rs.pause();
      chain(
        (async () => {
          await onVehicleJourney(vjXml);
        })().finally(() => rs.resume())
      );
    }
  });

  parser.on("error", (e) => {
    rs.destroy(e as any);
  });

  await new Promise<void>((resolve, reject) => {
    rs.on("data", (chunk) => parser.write(chunk));
    rs.on("end", () => resolve());
    rs.on("error", reject);
  });

  parser.close();
  await pending;
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
      // STREAMING: capture only the header sections we need (Operators/Services/JourneyPatternSections)
      // so we never load the full XML into memory.
      const header = await captureHeaderSections(filePath);

      const operatorsDoc = header.operatorsXml ? this.parser.parse(header.operatorsXml) : {};
      const servicesDoc = header.servicesXml ? this.parser.parse(header.servicesXml) : {};
      const jpsDoc = header.journeyPatternSectionsXml ? this.parser.parse(header.journeyPatternSectionsXml) : {};

      const txc: any = {
        Operators: operatorsDoc.Operators,
        Services: servicesDoc.Services,
        JourneyPatternSections: jpsDoc.JourneyPatternSections,
      };

      // Map JourneyPatternRef -> per-service context so we can route each streamed VehicleJourney correctly.
      const jpIdToContext = new Map<
        string,
        {
          routeId: string;
          keptChain: string[];
          existingSet: Set<string>;
          offsets: number[];
          serviceDate: Date;
          batch: Array<{ routeId: string; stopId: string; arrivalTime: Date; departureTime: Date }>;
        }
      >();

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

        // STREAMING: we will ingest VehicleJourneys later (single pass), so set up per-route batching state.
        // We'll attach these to a map keyed by JourneyPattern id so we can route each VehicleJourney.
        const journeyPatterns = asArray<any>(svc.StandardService?.JourneyPattern);
        for (const jp of journeyPatterns) {
          const jpId = String(jp?.["@_id"] ?? jp?.id ?? "");
          if (!jpId) continue;
          jpIdToContext.set(jpId, {
            routeId,
            keptChain,
            existingSet,
            offsets,
            serviceDate: opts.serviceDate,
            batch: [],
          });
        }
      }

      // STREAMING pass over the full file: ingest VehicleJourneys without loading the document into memory.
      const BATCH_MAX = 5000;

      const flushContext = async (ctx: {
        batch: Array<{ routeId: string; stopId: string; arrivalTime: Date; departureTime: Date }>;
      }) => {
        if (ctx.batch.length === 0) return 0;
        const n = ctx.batch.length;
        await prisma.busSchedule.createMany({ data: ctx.batch });
        ctx.batch = [];
        return n;
      };

      await streamVehicleJourneys(filePath, async (vjXml) => {
        const parsed = this.parser.parse(vjXml);
        const vj = parsed?.VehicleJourney;
        if (!vj) return;

        const jpRef = String(vj.JourneyPatternRef ?? "");
        if (!jpRef) return;

        const ctx = jpIdToContext.get(jpRef);
        if (!ctx) return; // not one of the JourneyPatterns for the Services we processed

        const dep = vj.DepartureTime;
        if (!dep) return;

        const start = timeToDate(ctx.serviceDate, String(dep));

        for (let i = 0; i < ctx.keptChain.length; i++) {
          const stopId = ctx.keptChain[i];
          if (!ctx.existingSet.has(stopId)) continue;

          const t = new Date(start.getTime() + ctx.offsets[i] * 1000);
          ctx.batch.push({
            routeId: ctx.routeId,
            stopId,
            arrivalTime: t,
            departureTime: t,
          });

          if (ctx.batch.length >= BATCH_MAX) {
            totalInserted += await flushContext(ctx);
          }
        }
      });

      // final flush
      for (const ctx of jpIdToContext.values()) {
        totalInserted += await flushContext(ctx);
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