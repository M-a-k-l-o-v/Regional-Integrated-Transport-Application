import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { SaxesParser, SaxesTag } from "saxes";
import { prisma } from "../infrastructure/orm/prisma/client";
import {
  BusJourneyTimingQuality,
  BusJourneyTimingSource,
  JobStatus,
  TransportMode,
} from "@prisma/client";
import { XMLParser } from "fast-xml-parser";

const OPERATOR_NAME_OVERRIDES: Record<string, string> = {
  KLCO: "Kirkby Lonsdale Coach Hire",
};

type IngestBusOptions = {
  serviceDate: Date;          // date you want schedules generated for
  keepContextStops?: number;  // default 2
  lancashireOnly?: boolean;   // default true
  scopeMode?: "strict" | "corridor" | "strict_corridor" | "all";
  corridorAnchor?: string; // default "lancaster"
};

function asArray<T>(x: any): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.length > 0)));
}

type WeekdayFlags = {
  runsMon: boolean;
  runsTue: boolean;
  runsWed: boolean;
  runsThu: boolean;
  runsFri: boolean;
  runsSat: boolean;
  runsSun: boolean;
};

type DateRangeOverride = {
  startDate: Date;
  endDate: Date;
  isRunning: boolean;
  reason: string;
};

type RouteCalendarAccumulator = {
  routeId: string;
  serviceCode: string;
  validFrom: Date | null;
  validTo: Date | null;
  weekdays: WeekdayFlags;
  hasWeekdayData: boolean;
  exceptions: DateRangeOverride[];
  sourceFile: string;
};

type JourneyPatternContext = {
  routeId: string;
  stopIds: string[];
  offsets: number[];
  fullStopIds: string[];
  fullLinkRefs: string[];
  selectedFullIndices: number[];
  serviceDate: Date;
  direction: string | null;
  destinationDisplay: string | null;
};

type TimingChain = {
  stopIds: string[];
  offsets: number[];
  linkRefs: string[];
};

type OffsetAnalysis = {
  totalEdgeCount: number;
  positiveEdgeCount: number;
  nonPositiveEdgeCount: number;
  hasNegativeEdge: boolean;
};

type TimingCandidate = {
  offsets: number[];
  source: BusJourneyTimingSource;
  analysis: OffsetAnalysis;
};

type TimingResolution = {
  offsets: number[];
  source: BusJourneyTimingSource;
  quality: BusJourneyTimingQuality;
  totalEdgeCount: number;
  positiveEdgeCount: number;
  nonPositiveEdgeCount: number;
  repairNote: string | null;
};

function weekdayFlagsAll(value: boolean): WeekdayFlags {
  return {
    runsMon: value,
    runsTue: value,
    runsWed: value,
    runsThu: value,
    runsFri: value,
    runsSat: value,
    runsSun: value,
  };
}

function mergeWeekdayFlags(target: WeekdayFlags, add: WeekdayFlags): void {
  target.runsMon = target.runsMon || add.runsMon;
  target.runsTue = target.runsTue || add.runsTue;
  target.runsWed = target.runsWed || add.runsWed;
  target.runsThu = target.runsThu || add.runsThu;
  target.runsFri = target.runsFri || add.runsFri;
  target.runsSat = target.runsSat || add.runsSat;
  target.runsSun = target.runsSun || add.runsSun;
}

function parseDateOnlyUtc(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (s.length === 0) return null;

  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toEndOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function collectTagNames(node: any, out: Set<string> = new Set<string>()): Set<string> {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const child of node) collectTagNames(child, out);
    return out;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (!k.startsWith("@_") && k !== "#text") out.add(k);
      collectTagNames(v, out);
    }
    return out;
  }
  if (typeof node === "string") {
    for (const token of node.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)) {
      out.add(token);
    }
  }
  return out;
}

function parseWeekdayFlagsFromOperatingProfile(operatingProfile: any): WeekdayFlags | null {
  const daysNode = operatingProfile?.RegularDayType?.DaysOfWeek;
  if (!daysNode) return null;

  const tokens = Array.from(collectTagNames(daysNode)).map((x) => x.toLowerCase());
  const flags = weekdayFlagsAll(false);
  let matched = false;

  const set = (names: Array<keyof WeekdayFlags>) => {
    for (const n of names) flags[n] = true;
    matched = true;
  };

  for (const token of tokens) {
    if (token === "monday") set(["runsMon"]);
    else if (token === "tuesday") set(["runsTue"]);
    else if (token === "wednesday") set(["runsWed"]);
    else if (token === "thursday") set(["runsThu"]);
    else if (token === "friday") set(["runsFri"]);
    else if (token === "saturday") set(["runsSat"]);
    else if (token === "sunday") set(["runsSun"]);
    else if (token === "mondaytofriday" || token === "weekdays" || token === "weekday") {
      set(["runsMon", "runsTue", "runsWed", "runsThu", "runsFri"]);
    } else if (token === "mondaytothursday") {
      set(["runsMon", "runsTue", "runsWed", "runsThu"]);
    } else if (token === "mondaytosaturday") {
      set(["runsMon", "runsTue", "runsWed", "runsThu", "runsFri", "runsSat"]);
    } else if (token === "mondaytosunday" || token === "daily" || token === "everyday") {
      set(["runsMon", "runsTue", "runsWed", "runsThu", "runsFri", "runsSat", "runsSun"]);
    } else if (token === "weekend" || token === "weekends" || token === "saturdayandsunday") {
      set(["runsSat", "runsSun"]);
    } else if (token === "notsaturday") {
      set(["runsMon", "runsTue", "runsWed", "runsThu", "runsFri", "runsSun"]);
    } else if (token === "notsunday") {
      set(["runsMon", "runsTue", "runsWed", "runsThu", "runsFri", "runsSat"]);
    }
  }

  return matched ? flags : null;
}

function collectDateRanges(node: any): any[] {
  const out: any[] = [];
  const walk = (value: any) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }
    if (typeof value !== "object") return;

    for (const [k, v] of Object.entries(value)) {
      if (k === "DateRange") {
        out.push(...asArray<any>(v));
        continue;
      }
      walk(v);
    }
  };

  walk(node);
  return out;
}

function parseExceptionRangesFromOperatingProfile(operatingProfile: any): DateRangeOverride[] {
  const out: DateRangeOverride[] = [];
  const special = operatingProfile?.SpecialDaysOperation;
  if (!special) return out;

  const addFromNode = (node: any, isRunning: boolean, reason: string) => {
    for (const range of collectDateRanges(node)) {
      const start = parseDateOnlyUtc(range?.StartDate);
      const endBase = parseDateOnlyUtc(range?.EndDate ?? range?.StartDate);
      if (!start || !endBase) continue;
      out.push({
        startDate: start,
        endDate: toEndOfUtcDay(endBase),
        isRunning,
        reason,
      });
    }
  };

  addFromNode(special?.DaysOfOperation, true, "special_days_operation");
  addFromNode(special?.DaysOfNonOperation, false, "special_days_non_operation");

  return out;
}

function parseServiceValidity(svc: any): { validFrom: Date | null; validTo: Date | null } {
  const start = parseDateOnlyUtc(svc?.OperatingPeriod?.StartDate);
  const endBase = parseDateOnlyUtc(svc?.OperatingPeriod?.EndDate);
  const end = endBase ? toEndOfUtcDay(endBase) : null;
  return { validFrom: start, validTo: end };
}

function extractJourneyPatternSectionRefs(jp: any): string[] {
  const refsNode = jp?.JourneyPatternSectionRefs;
  if (!refsNode) return [];

  // Variant A:
  // <JourneyPatternSectionRefs>
  //   <JourneyPatternSectionRef>JPS1</JourneyPatternSectionRef>
  // </JourneyPatternSectionRefs>
  const nested = asArray<any>(refsNode?.JourneyPatternSectionRef).map((x) => String(x ?? "").trim());
  if (nested.length > 0) return uniqueStrings(nested);

  // Variant B:
  // <JourneyPatternSectionRefs>JPS1 JPS2</JourneyPatternSectionRefs>
  if (typeof refsNode === "string") {
    const inline = refsNode
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    return uniqueStrings(inline);
  }

  // Variant C:
  // Parser can expose text under "#text".
  const text = String((refsNode as any)["#text"] ?? "").trim();
  if (text.length > 0) {
    const inline = text
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    return uniqueStrings(inline);
  }

  return [];
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

function getStopPointRef(node: any): string {
  return String(node?.StopPointRef ?? "").trim();
}

function timingLinkDurationSeconds(link: any): number {
  return (
    durationToSeconds(link?.RunTime) +
    durationToSeconds(link?.WaitTime) +
    durationToSeconds(link?.From?.WaitTime) +
    durationToSeconds(link?.To?.WaitTime)
  );
}

function buildTimingChainFromLinks(timingLinks: any[]): TimingChain | null {
  const stopIds: string[] = [];
  const offsets: number[] = [];
  const linkRefs: string[] = [];

  for (const link of timingLinks) {
    const fromRef = getStopPointRef(link?.From);
    const toRef = getStopPointRef(link?.To);
    if (!fromRef || !toRef) continue;

    if (stopIds.length === 0) {
      stopIds.push(fromRef);
      offsets.push(0);
    } else if (stopIds[stopIds.length - 1] !== fromRef) {
      return null;
    }

    const nextOffset = offsets[offsets.length - 1] + timingLinkDurationSeconds(link);
    stopIds.push(toRef);
    offsets.push(nextOffset);
    linkRefs.push(String(link?.["@_id"] ?? link?.id ?? "").trim());
  }

  return stopIds.length > 0 ? { stopIds, offsets, linkRefs } : null;
}

function countPositiveOffsetEdges(offsets: number[]): number {
  let total = 0;
  for (let i = 1; i < offsets.length; i++) {
    if (offsets[i] > offsets[i - 1]) total++;
  }
  return total;
}

function selectOffsetsByIndices(offsets: number[], indices: number[]): number[] | null {
  if (indices.some((index) => index < 0 || index >= offsets.length)) return null;
  return indices.map((index) => offsets[index]);
}

function buildOffsetsFromLinkRefs(linkRefs: string[], durationByLinkRef: Map<string, number>): number[] | null {
  const offsets = [0];
  for (const linkRef of linkRefs) {
    if (!linkRef || !durationByLinkRef.has(linkRef)) return null;
    offsets.push(offsets[offsets.length - 1] + (durationByLinkRef.get(linkRef) ?? 0));
  }
  return offsets;
}

function analyseOffsets(offsets: number[]): OffsetAnalysis {
  let positiveEdgeCount = 0;
  let nonPositiveEdgeCount = 0;
  let hasNegativeEdge = false;

  for (let index = 1; index < offsets.length; index += 1) {
    const delta = offsets[index] - offsets[index - 1];
    if (delta > 0) {
      positiveEdgeCount += 1;
    } else {
      nonPositiveEdgeCount += 1;
      if (delta < 0) hasNegativeEdge = true;
    }
  }

  return {
    totalEdgeCount: Math.max(0, offsets.length - 1),
    positiveEdgeCount,
    nonPositiveEdgeCount,
    hasNegativeEdge,
  };
}

function compareTimingCandidates(left: TimingCandidate, right: TimingCandidate): number {
  if (left.analysis.nonPositiveEdgeCount !== right.analysis.nonPositiveEdgeCount) {
    return left.analysis.nonPositiveEdgeCount - right.analysis.nonPositiveEdgeCount;
  }
  if (left.analysis.positiveEdgeCount !== right.analysis.positiveEdgeCount) {
    return right.analysis.positiveEdgeCount - left.analysis.positiveEdgeCount;
  }
  if (left.source === BusJourneyTimingSource.VEHICLE_JOURNEY_LINKS && right.source !== BusJourneyTimingSource.VEHICLE_JOURNEY_LINKS) {
    return -1;
  }
  if (right.source === BusJourneyTimingSource.VEHICLE_JOURNEY_LINKS && left.source !== BusJourneyTimingSource.VEHICLE_JOURNEY_LINKS) {
    return 1;
  }
  return 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function interpolateOffsets(offsets: number[]): number[] | null {
  if (offsets.length <= 1) return [...offsets];

  const baseAnalysis = analyseOffsets(offsets);
  if (baseAnalysis.nonPositiveEdgeCount === 0) return [...offsets];
  if (baseAnalysis.hasNegativeEdge) return null;

  const repaired = [...offsets];
  const positiveDurations: number[] = [];
  for (let index = 1; index < offsets.length; index += 1) {
    const delta = offsets[index] - offsets[index - 1];
    if (delta > 0) positiveDurations.push(delta);
  }

  const fallbackEdgeSeconds = Math.max(60, positiveDurations.length > 0 ? median(positiveDurations) : 60);

  let anchorIndex = 0;
  while (anchorIndex < repaired.length - 1) {
    if (repaired[anchorIndex + 1] > repaired[anchorIndex]) {
      anchorIndex += 1;
      continue;
    }

    let nextIndex = anchorIndex + 1;
    while (nextIndex < repaired.length && repaired[nextIndex] <= repaired[anchorIndex]) {
      nextIndex += 1;
    }

    if (nextIndex < repaired.length) {
      const edgeCount = nextIndex - anchorIndex;
      const totalSpan = repaired[nextIndex] - repaired[anchorIndex];
      if (totalSpan < edgeCount) return null;

      let previous = repaired[anchorIndex];
      for (let innerIndex = 1; innerIndex < edgeCount; innerIndex += 1) {
        const proportional = repaired[anchorIndex] + Math.round((totalSpan * innerIndex) / edgeCount);
        const nextValue = Math.max(previous + 1, proportional);
        repaired[anchorIndex + innerIndex] = nextValue;
        previous = nextValue;
      }

      anchorIndex = nextIndex;
      continue;
    }

    for (let innerIndex = anchorIndex + 1; innerIndex < repaired.length; innerIndex += 1) {
      repaired[innerIndex] = repaired[innerIndex - 1] + fallbackEdgeSeconds;
    }
    break;
  }

  return analyseOffsets(repaired).nonPositiveEdgeCount === 0 ? repaired : null;
}

function buildTimingPeerKey(
  routeId: string,
  journeyPatternRef: string,
  lineRef: string | null,
  direction: string | null,
  stopIds: string[]
): string {
  return buildJourneyKey([routeId, journeyPatternRef, lineRef ?? "", direction ?? "", ...stopIds]);
}

function qualityRank(quality: BusJourneyTimingQuality): number {
  if (quality === BusJourneyTimingQuality.EXACT) return 3;
  if (quality === BusJourneyTimingQuality.REPAIRED) return 2;
  if (quality === BusJourneyTimingQuality.ESTIMATED) return 1;
  return 0;
}

function isBetterTimingResolution(left: TimingResolution, right: TimingResolution): boolean {
  const leftQuality = qualityRank(left.quality);
  const rightQuality = qualityRank(right.quality);
  if (leftQuality !== rightQuality) {
    return leftQuality > rightQuality;
  }
  if (left.nonPositiveEdgeCount !== right.nonPositiveEdgeCount) {
    return left.nonPositiveEdgeCount < right.nonPositiveEdgeCount;
  }
  if (left.positiveEdgeCount !== right.positiveEdgeCount) {
    return left.positiveEdgeCount > right.positiveEdgeCount;
  }
  return false;
}

function timeToDate(serviceDate: Date, hhmmss: string): Date {
  // hh:mm:ss or hh:mm
  const [h, m, s] = hhmmss.split(":").map(Number);
  const d = new Date(serviceDate);
  d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
  return d;
}

function toSourceFileKey(filePath: string): string {
  const rel = path.relative(process.cwd(), filePath).trim();
  if (rel.length > 0 && !rel.startsWith("..")) return rel;
  return path.basename(filePath);
}

function buildJourneyKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function resolveJourneyTiming(
  directCandidates: TimingCandidate[],
  peerResolution: TimingResolution | null
): TimingResolution {
  const rankedDirectCandidates = [...directCandidates].sort(compareTimingCandidates);
  const bestDirectCandidate = rankedDirectCandidates[0] ?? {
    offsets: [0],
    source: BusJourneyTimingSource.UNUSABLE,
    analysis: analyseOffsets([0]),
  };

  if (bestDirectCandidate.analysis.nonPositiveEdgeCount === 0) {
    return {
      offsets: bestDirectCandidate.offsets,
      source: bestDirectCandidate.source,
      quality: BusJourneyTimingQuality.EXACT,
      totalEdgeCount: bestDirectCandidate.analysis.totalEdgeCount,
      positiveEdgeCount: bestDirectCandidate.analysis.positiveEdgeCount,
      nonPositiveEdgeCount: bestDirectCandidate.analysis.nonPositiveEdgeCount,
      repairNote: null,
    };
  }

  if (peerResolution && peerResolution.quality !== BusJourneyTimingQuality.INVALID) {
    return {
      ...peerResolution,
      source: BusJourneyTimingSource.DERIVED_FROM_PATTERN_PEER,
      quality: BusJourneyTimingQuality.REPAIRED,
      repairNote: "derived_from_pattern_peer",
    };
  }

  const interpolatedOffsets = interpolateOffsets(bestDirectCandidate.offsets);
  if (interpolatedOffsets) {
    const analysis = analyseOffsets(interpolatedOffsets);
    if (analysis.nonPositiveEdgeCount === 0) {
      return {
        offsets: interpolatedOffsets,
        source: BusJourneyTimingSource.INTERPOLATED,
        quality: BusJourneyTimingQuality.ESTIMATED,
        totalEdgeCount: analysis.totalEdgeCount,
        positiveEdgeCount: analysis.positiveEdgeCount,
        nonPositiveEdgeCount: analysis.nonPositiveEdgeCount,
        repairNote: bestDirectCandidate.analysis.hasNegativeEdge
          ? "interpolated_after_negative_edges"
          : "interpolated_from_flat_offsets",
      };
    }
  }

  return {
    offsets: bestDirectCandidate.offsets,
    source: BusJourneyTimingSource.UNUSABLE,
    quality: BusJourneyTimingQuality.INVALID,
    totalEdgeCount: bestDirectCandidate.analysis.totalEdgeCount,
    positiveEdgeCount: bestDirectCandidate.analysis.positiveEdgeCount,
    nonPositiveEdgeCount: bestDirectCandidate.analysis.nonPositiveEdgeCount,
    repairNote: bestDirectCandidate.analysis.hasNegativeEdge ? "negative_edge_offsets" : "non_positive_offsets",
  };
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
  const chain = (fn: () => Promise<void>) => {
    pending = pending.then(fn);
    return pending;
  };

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
      chain(async () => {
        try {
          await onVehicleJourney(vjXml);
        } finally {
          rs.resume();
        }
      });
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
    const legacyLancashireOnly = opts.lancashireOnly ?? true;
    const scopeMode = opts.scopeMode ?? (legacyLancashireOnly ? "strict" : "all");
    const corridorAnchor = (opts.corridorAnchor ?? "lancaster").trim().toLowerCase();
    const sourceFile = toSourceFileKey(filePath);

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

      // Build section index once (sectionId -> timingLinks).
      const sectionToLinks = new Map<string, any[]>();
      const jpSections = asArray<any>(txc.JourneyPatternSections?.JourneyPatternSection);
      for (const sec of jpSections) {
        const sectionId = String(sec?.["@_id"] ?? sec?.id ?? "");
        if (!sectionId) continue;
        sectionToLinks.set(sectionId, asArray<any>(sec?.JourneyPatternTimingLink));
      }

      // Map JourneyPatternRef -> per-service context so we can route each streamed VehicleJourney correctly.
      const jpIdToContext = new Map<string, JourneyPatternContext>();
      const routeCalendarByRouteId = new Map<string, RouteCalendarAccumulator>();

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
      const canonicalOperatorName = OPERATOR_NAME_OVERRIDES[operatorId] ?? operatorName;

      await prisma.operator.upsert({
        where: { operatorId },
        update: { name: canonicalOperatorName },
        create: { operatorId, name: canonicalOperatorName },
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
      const dayStart = new Date(opts.serviceDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const routesPendingClear = new Set<string>();
      const routesWithContext = new Set<string>();

      for (const svc of services) {
        const lineName = svc.Lines?.Line?.LineName ?? svc.Lines?.Line?.LinePublicName ?? "UNKNOWN_LINE";
        const serviceCode = svc.ServiceCode ?? svc["@_id"] ?? lineName;

        const routeId = `bus:${operatorId}:${String(serviceCode)}`;
        const validity = parseServiceValidity(svc);
        const serviceWeekdays = parseWeekdayFlagsFromOperatingProfile(svc?.OperatingProfile);
        const serviceExceptions = parseExceptionRangesFromOperatingProfile(svc?.OperatingProfile);

        await prisma.busRoute.upsert({
          where: { routeId },
          update: { mode: TransportMode.BUS, operatorId },
          create: { routeId, mode: TransportMode.BUS, operatorId },
        });

        routeCalendarByRouteId.set(routeId, {
          routeId,
          serviceCode: String(serviceCode),
          validFrom: validity.validFrom,
          validTo: validity.validTo,
          weekdays: serviceWeekdays ?? weekdayFlagsAll(false),
          hasWeekdayData: serviceWeekdays !== null,
          exceptions: serviceExceptions,
          sourceFile,
        });

        let routeHasContext = false;
        const journeyPatterns = asArray<any>(svc.StandardService?.JourneyPattern);
        for (const jp of journeyPatterns) {
          const jpId = String(jp?.["@_id"] ?? jp?.id ?? "");
          if (!jpId) continue;

          // Pull links only for sections referenced by this JourneyPattern.
          const sectionRefs = extractJourneyPatternSectionRefs(jp);
          const timingLinks: any[] = [];
          if (sectionRefs.length > 0) {
            for (const ref of sectionRefs) {
              const links = sectionToLinks.get(ref);
              if (links) timingLinks.push(...links);
            }
          }

          // Fallback: some feeds inline links directly on JourneyPattern.
          if (timingLinks.length === 0) {
            timingLinks.push(...asArray<any>(jp?.JourneyPatternTimingLink));
          }
          if (timingLinks.length === 0) continue;

          const timingChain = buildTimingChainFromLinks(timingLinks);
          if (!timingChain) continue;
          const chain = timingChain.stopIds;
          if (chain.length === 0) continue;

          const chainBusStops = await prisma.busStop.findMany({
            where: { stopId: { in: chain } },
            select: { stopId: true, name: true },
          });
          const stopMetaById = new Map(chainBusStops.map((row) => [row.stopId, row]));

          // Coverage filter with optional context.
          let keepStart = 0;
          let keepEnd = chain.length - 1;
          if (scopeMode !== "all") {
            const inCovIdx = chain
              .map((stopId, idx) => ({ stopId, idx }))
              .filter((x) => {
                const isStrict = x.stopId.startsWith("250");
                const row = stopMetaById.get(x.stopId);
                const isCorridor = row ? row.name.toLowerCase().includes(corridorAnchor) : false;

                if (scopeMode === "strict") return isStrict;
                if (scopeMode === "corridor") return isCorridor;
                // strict_corridor = union of strict and corridor anchors.
                return isStrict || isCorridor;
              });

            if (inCovIdx.length === 0) continue;

            const first = inCovIdx[0].idx;
            const last = inCovIdx[inCovIdx.length - 1].idx;
            keepStart = Math.max(0, first - keepN);
            keepEnd = Math.min(chain.length - 1, last + keepN);
          }

          // Keep only stops that exist in BusStop (FK-safe + less memory).
          const existingSet = new Set(chainBusStops.map((x) => x.stopId));
          const stopIds: string[] = [];
          const offsets: number[] = [];
          const selectedFullIndices: number[] = [];

          for (let i = keepStart; i <= keepEnd; i++) {
            const stopId = chain[i];
            if (!existingSet.has(stopId)) continue;
            stopIds.push(stopId);
            offsets.push(timingChain.offsets[i]);
            selectedFullIndices.push(i);
          }

          if (stopIds.length === 0) continue;

          jpIdToContext.set(jpId, {
            routeId,
            stopIds,
            offsets,
            fullStopIds: chain,
            fullLinkRefs: timingChain.linkRefs,
            selectedFullIndices,
            serviceDate: opts.serviceDate,
            direction: typeof jp?.Direction === "string" ? jp.Direction.trim().toLowerCase() || null : null,
            destinationDisplay:
              typeof jp?.DestinationDisplay === "string" ? jp.DestinationDisplay.trim() || null : null,
          });
          routeHasContext = true;
        }

        // Defer route/day clear until we actually emit at least one row for this route.
        // This avoids wiping previous good data when a later duplicate file resolves to zero rows.
        if (routeHasContext) {
          routesPendingClear.add(routeId);
          routesWithContext.add(routeId);
        }
      }

      const routesWithContextList = Array.from(routesWithContext);
      if (routesWithContextList.length > 0) {
        await prisma.busJourney.deleteMany({
          where: {
            routeId: { in: routesWithContextList },
            serviceDate: dayStart,
            sourceFile,
          },
        });
      }

      const timingPeerByPattern = new Map<string, TimingResolution>();

      // STREAMING pass over the full file: ingest VehicleJourneys without loading the document into memory.
      const BATCH_MAX = 2000;
      const batch: Array<{ routeId: string; stopId: string; arrivalTime: Date; departureTime: Date }> = [];
      let totalJourneysPersisted = 0;
      let totalJourneyStopsPersisted = 0;
      let totalVehicleTimingOverrides = 0;
      let totalExactJourneyTimings = 0;
      let totalRepairedJourneyTimings = 0;
      let totalEstimatedJourneyTimings = 0;
      let totalInvalidJourneyTimings = 0;

      const flushBatch = async () => {
        if (batch.length === 0) return 0;
        const n = batch.length;
        await prisma.busSchedule.createMany({
          data: batch,
          skipDuplicates: true,
        });
        batch.length = 0;
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

        const calendar = routeCalendarByRouteId.get(ctx.routeId);
        if (calendar) {
          const vjWeekdays = parseWeekdayFlagsFromOperatingProfile(vj?.OperatingProfile);
          if (vjWeekdays) {
            if (!calendar.hasWeekdayData) {
              calendar.weekdays = weekdayFlagsAll(false);
            }
            mergeWeekdayFlags(calendar.weekdays, vjWeekdays);
            calendar.hasWeekdayData = true;
          }
          calendar.exceptions.push(...parseExceptionRangesFromOperatingProfile(vj?.OperatingProfile));
        }

        const dep = vj.DepartureTime;
        if (!dep) return;

        const start = timeToDate(ctx.serviceDate, String(dep));
        const vehicleJourneyCode = String(vj.VehicleJourneyCode ?? vj.PrivateCode ?? `${jpRef}:${dep}`);
        const lineRef = typeof vj.LineRef === "string" ? vj.LineRef.trim() || null : null;
        const destinationDisplay =
          typeof vj.DestinationDisplay === "string" ? vj.DestinationDisplay.trim() || null : ctx.destinationDisplay;
        const journeyKey = buildJourneyKey([
          ctx.routeId,
          dayStart.toISOString(),
          sourceFile,
          vehicleJourneyCode,
          jpRef,
          String(dep),
          lineRef ?? "",
        ]);
        const timingPeerKey = buildTimingPeerKey(ctx.routeId, jpRef, lineRef, ctx.direction, ctx.stopIds);
        const directTimingCandidates: TimingCandidate[] = [
          {
            offsets: ctx.offsets,
            source: BusJourneyTimingSource.JOURNEY_PATTERN_LINKS,
            analysis: analyseOffsets(ctx.offsets),
          },
        ];
        const vehicleTimingLinks = asArray<any>(vj.VehicleJourneyTimingLink);
        const vehicleDurationByLinkRef = new Map<string, number>();
        for (const link of vehicleTimingLinks) {
          const linkRef = String(link?.JourneyPatternTimingLinkRef ?? "").trim();
          if (!linkRef) continue;
          vehicleDurationByLinkRef.set(linkRef, timingLinkDurationSeconds(link));
        }
        const vehicleFullOffsets = buildOffsetsFromLinkRefs(ctx.fullLinkRefs, vehicleDurationByLinkRef);
        if (vehicleFullOffsets) {
          const selectedVehicleOffsets = selectOffsetsByIndices(vehicleFullOffsets, ctx.selectedFullIndices);
          if (selectedVehicleOffsets) {
            directTimingCandidates.push({
              offsets: selectedVehicleOffsets,
              source: BusJourneyTimingSource.VEHICLE_JOURNEY_LINKS,
              analysis: analyseOffsets(selectedVehicleOffsets),
            });
            const patternPositiveEdges = directTimingCandidates[0].analysis.positiveEdgeCount;
            const vehiclePositiveEdges = countPositiveOffsetEdges(selectedVehicleOffsets);
            if (vehiclePositiveEdges > patternPositiveEdges) {
              totalVehicleTimingOverrides++;
            }
          }
        }

        const peerTiming = timingPeerByPattern.get(timingPeerKey) ?? null;
        const timingResolution = resolveJourneyTiming(directTimingCandidates, peerTiming);
        const effectiveOffsets = timingResolution.offsets;
        if (timingResolution.quality === BusJourneyTimingQuality.EXACT) totalExactJourneyTimings++;
        else if (timingResolution.quality === BusJourneyTimingQuality.REPAIRED) totalRepairedJourneyTimings++;
        else if (timingResolution.quality === BusJourneyTimingQuality.ESTIMATED) totalEstimatedJourneyTimings++;
        else totalInvalidJourneyTimings++;

        const journeyStopRows = ctx.stopIds.map((stopId, i) => {
          const t = new Date(start.getTime() + effectiveOffsets[i] * 1000);
          return {
            stopId,
            stopSeq: i,
            arrivalTime: t,
            departureTime: t,
            offsetSeconds: effectiveOffsets[i],
          };
        });

        const journey = await prisma.busJourney.upsert({
          where: { journeyKey },
          update: {
            routeId: ctx.routeId,
            vehicleJourneyCode,
            journeyPatternRef: jpRef,
            lineRef,
            direction: ctx.direction,
            destinationDisplay,
            serviceDate: dayStart,
            departureTime: start,
            sourceFile,
            timingSource: timingResolution.source,
            timingQuality: timingResolution.quality,
            totalEdgeCount: timingResolution.totalEdgeCount,
            positiveEdgeCount: timingResolution.positiveEdgeCount,
            nonPositiveEdgeCount: timingResolution.nonPositiveEdgeCount,
            timingRepairNote: timingResolution.repairNote,
          },
          create: {
            journeyKey,
            routeId: ctx.routeId,
            vehicleJourneyCode,
            journeyPatternRef: jpRef,
            lineRef,
            direction: ctx.direction,
            destinationDisplay,
            serviceDate: dayStart,
            departureTime: start,
            sourceFile,
            timingSource: timingResolution.source,
            timingQuality: timingResolution.quality,
            totalEdgeCount: timingResolution.totalEdgeCount,
            positiveEdgeCount: timingResolution.positiveEdgeCount,
            nonPositiveEdgeCount: timingResolution.nonPositiveEdgeCount,
            timingRepairNote: timingResolution.repairNote,
          },
          select: { journeyId: true },
        });

        const existingPeer = timingPeerByPattern.get(timingPeerKey);
        if (
          timingResolution.quality !== BusJourneyTimingQuality.INVALID &&
          (!existingPeer || isBetterTimingResolution(timingResolution, existingPeer))
        ) {
          timingPeerByPattern.set(timingPeerKey, timingResolution);
        }

        await prisma.busJourneyStop.deleteMany({
          where: { journeyId: journey.journeyId },
        });

        await prisma.busJourneyStop.createMany({
          data: journeyStopRows.map((row) => ({
            journeyId: journey.journeyId,
            stopId: row.stopId,
            stopSeq: row.stopSeq,
            arrivalTime: row.arrivalTime,
            departureTime: row.departureTime,
            offsetSeconds: row.offsetSeconds,
          })),
        });

        totalJourneysPersisted++;
        totalJourneyStopsPersisted += journeyStopRows.length;

        if (routesPendingClear.has(ctx.routeId)) {
          await prisma.busSchedule.deleteMany({
            where: {
              routeId: ctx.routeId,
              departureTime: { gte: dayStart, lt: dayEnd },
            },
          });
          routesPendingClear.delete(ctx.routeId);
        }

        for (const row of journeyStopRows) {
          batch.push({
            routeId: ctx.routeId,
            stopId: row.stopId,
            arrivalTime: row.arrivalTime,
            departureTime: row.departureTime,
          });

          if (batch.length >= BATCH_MAX) {
            totalInserted += await flushBatch();
          }
        }
      });

      // final flush
      totalInserted += await flushBatch();

      for (const routeId of routesWithContext) {
        const calendar = routeCalendarByRouteId.get(routeId);
        if (!calendar) continue;

        const weekdays = calendar.hasWeekdayData ? calendar.weekdays : weekdayFlagsAll(true);

        await prisma.busServiceCalendar.upsert({
          where: { routeId },
          update: {
            serviceCode: calendar.serviceCode,
            validFrom: calendar.validFrom,
            validTo: calendar.validTo,
            runsMon: weekdays.runsMon,
            runsTue: weekdays.runsTue,
            runsWed: weekdays.runsWed,
            runsThu: weekdays.runsThu,
            runsFri: weekdays.runsFri,
            runsSat: weekdays.runsSat,
            runsSun: weekdays.runsSun,
            sourceFile: calendar.sourceFile,
          },
          create: {
            routeId: calendar.routeId,
            serviceCode: calendar.serviceCode,
            validFrom: calendar.validFrom,
            validTo: calendar.validTo,
            runsMon: weekdays.runsMon,
            runsTue: weekdays.runsTue,
            runsWed: weekdays.runsWed,
            runsThu: weekdays.runsThu,
            runsFri: weekdays.runsFri,
            runsSat: weekdays.runsSat,
            runsSun: weekdays.runsSun,
            sourceFile: calendar.sourceFile,
          },
        });

        await prisma.busServiceException.deleteMany({ where: { routeId } });

        const seen = new Set<string>();
        const dedupedExceptions = calendar.exceptions.filter((row) => {
          const key = `${row.startDate.toISOString()}|${row.endDate.toISOString()}|${row.isRunning}|${row.reason}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (dedupedExceptions.length > 0) {
          await prisma.busServiceException.createMany({
            data: dedupedExceptions.map((row) => ({
              routeId: calendar.routeId,
              serviceCode: calendar.serviceCode,
              startDate: row.startDate,
              endDate: row.endDate,
              isRunning: row.isRunning,
              reason: row.reason,
              sourceFile: calendar.sourceFile,
            })),
          });
        }
      }

      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: JobStatus.SUCCESS, recordsProcessed: totalInserted },
      });

      console.log("[bus] done:", {
        file: path.basename(filePath),
        inserted: totalInserted,
        journeys: totalJourneysPersisted,
        journeyStops: totalJourneyStopsPersisted,
        vehicleTimingOverrides: totalVehicleTimingOverrides,
        exactJourneyTimings: totalExactJourneyTimings,
        repairedJourneyTimings: totalRepairedJourneyTimings,
        estimatedJourneyTimings: totalEstimatedJourneyTimings,
        invalidJourneyTimings: totalInvalidJourneyTimings,
      });
    } catch (err: any) {
      await prisma.jobRun.update({
        where: { jobRunId: run.jobRunId },
        data: { finishedAt: new Date(), status: JobStatus.FAILED, errorMessage: String(err?.message ?? err) },
      });
      throw err;
    }
  }
}
