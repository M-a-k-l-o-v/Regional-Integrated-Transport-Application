import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../infrastructure/orm/prisma/client";
import { JourneyPlanningService } from "../services/journeys/JourneyPlanningService";

// Gated behind RUN_DB_TESTS=1 so the normal `npm test` run stays unit-only.
// Data: BusSchedule is only populated for a handful of dates (see memory). 2026-05-04
// is a Monday inside the populated set, already exercised by the k6 load test.
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";
const TEST_DATE = "2026-05-04";
const TEST_TIME = "08:30";
const MAX_ORIGIN_WAIT_MS = 20 * 60 * 1000;
const PAIR_COUNT = 50;
const RNG_SEED = 0x5cc200;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Pair = { origin: string; destination: string };

const suite = RUN_DB_TESTS ? describe : describe.skip;

suite("JourneyPlanningService — serviceFilter integration (50 random pairs)", () => {
  const service = new JourneyPlanningService(prisma);
  let pairs: Pair[] = [];

  beforeAll(async () => {
    const rows = await prisma.busSchedule.findMany({
      where: {
        departureTime: {
          gte: new Date(`${TEST_DATE}T00:00:00.000Z`),
          lt: new Date(`${TEST_DATE}T23:59:59.999Z`),
        },
      },
      select: { stopId: true },
      distinct: ["stopId"],
      take: 400,
    });
    const stops = seededShuffle(
      rows.map((r) => r.stopId),
      RNG_SEED
    );
    if (stops.length < 2 * PAIR_COUNT) {
      throw new Error(
        `Need ${2 * PAIR_COUNT} distinct stops with departures on ${TEST_DATE}, got ${stops.length}`
      );
    }
    pairs = Array.from({ length: PAIR_COUNT }, (_, i) => ({
      origin: stops[i * 2],
      destination: stops[i * 2 + 1],
    }));

    const fixturePath = join(__dirname, "fixtures", "journeyFilterPairs.json");
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      JSON.stringify({ date: TEST_DATE, time: TEST_TIME, seed: RNG_SEED, pairs }, null, 2)
    );
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it(
    "forces first-leg match or returns noMatchReason for 50 random pairs",
    async () => {
      expect(pairs.length).toBe(PAIR_COUNT);

      const stats = {
        baselineEmpty: 0,
        baselineNoBusLeg: 0,
        filterMatchedFirstLeg: 0,
        filterReturnedNoMatch: 0,
      };
      const failures: string[] = [];
      const perPair: Array<{
        n: number;
        origin: string;
        destination: string;
        filter: string | "-";
        outcome: string;
        waitMin?: number;
      }> = [];

      // Mirror parsePlannerDateTime: local-time parse, no Z suffix.
      const requestedDepartureMs = new Date(`${TEST_DATE}T${TEST_TIME}:00`).getTime();

      for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        const n = i + 1;
        const baseline = await service.plan({
          origin: { type: "bus_stop", id: pair.origin },
          destination: { type: "bus_stop", id: pair.destination },
          date: TEST_DATE,
          time: TEST_TIME,
          preference: "fastest",
          maxItineraries: 3,
        });

        if (baseline.itineraries.length === 0) {
          stats.baselineEmpty += 1;
          perPair.push({ n, origin: pair.origin, destination: pair.destination, filter: "-", outcome: "baselineEmpty" });
          continue;
        }

        const topLegs = baseline.itineraries[0].legs;
        const firstBusLeg = topLegs.find((leg) => leg.mode === "bus" && !!leg.line);
        if (!firstBusLeg || !firstBusLeg.line) {
          stats.baselineNoBusLeg += 1;
          perPair.push({ n, origin: pair.origin, destination: pair.destination, filter: "-", outcome: "baselineNoBusLeg" });
          continue;
        }
        const dominantService = firstBusLeg.line;

        const filtered = await service.plan({
          origin: { type: "bus_stop", id: pair.origin },
          destination: { type: "bus_stop", id: pair.destination },
          date: TEST_DATE,
          time: TEST_TIME,
          preference: "fastest",
          maxItineraries: 3,
          serviceFilter: dominantService,
        });

        if (filtered.itineraries.length === 0) {
          if (filtered.noMatchReason == null) {
            failures.push(
              `${pair.origin}->${pair.destination} filter=${dominantService}: empty result but noMatchReason is null`
            );
          }
          stats.filterReturnedNoMatch += 1;
          perPair.push({
            n,
            origin: pair.origin,
            destination: pair.destination,
            filter: dominantService,
            outcome: `noMatch:${filtered.noMatchReason ?? "null"}`,
          });
          continue;
        }

        const legs = filtered.itineraries[0].legs;
        const firstTransit = legs.find((leg) => leg.mode !== "walk");
        if (!firstTransit) {
          failures.push(`${pair.origin}->${pair.destination}: filtered result has no transit leg`);
          continue;
        }
        if (firstTransit.mode !== "bus") {
          failures.push(
            `${pair.origin}->${pair.destination}: first transit leg was ${firstTransit.mode}, expected bus`
          );
          continue;
        }
        if ((firstTransit.line ?? "").toUpperCase() !== dominantService.toUpperCase()) {
          failures.push(
            `${pair.origin}->${pair.destination}: first leg line=${firstTransit.line}, expected ${dominantService}`
          );
          continue;
        }

        const firstTransitIdx = legs.indexOf(firstTransit);
        const precedingLegs = legs.slice(0, firstTransitIdx);
        const arrivalAtBoardingMs = precedingLegs.length > 0
          ? new Date(precedingLegs[precedingLegs.length - 1].arrivalTime!).getTime()
          : requestedDepartureMs;
        const waitMs = new Date(firstTransit.departureTime!).getTime() - arrivalAtBoardingMs;
        if (waitMs > MAX_ORIGIN_WAIT_MS) {
          failures.push(
            `${pair.origin}->${pair.destination}: wait-at-stop ${(waitMs / 60000).toFixed(1)}min exceeds ${MAX_ORIGIN_WAIT_MS / 60000}min cap`
          );
          continue;
        }

        stats.filterMatchedFirstLeg += 1;
        perPair.push({
          n,
          origin: pair.origin,
          destination: pair.destination,
          filter: dominantService,
          outcome: "match",
          waitMin: Number((waitMs / 60000).toFixed(1)),
        });
      }

      // eslint-disable-next-line no-console
      console.log("[serviceFilter] stats:", stats);
      // eslint-disable-next-line no-console
      console.log(
        "[serviceFilter] per-pair:\n" +
          perPair
            .map((p) =>
              `#${String(p.n).padStart(2, " ")}  ${p.origin}  ->  ${p.destination}  | filter=${p.filter}  | ${p.outcome}${
                p.waitMin !== undefined ? ` (wait ${p.waitMin}m)` : ""
              }`
            )
            .join("\n")
      );
      expect(failures, failures.join("\n")).toEqual([]);
      expect(stats.filterMatchedFirstLeg + stats.filterReturnedNoMatch).toBeGreaterThan(0);
    },
    10 * 60 * 1000
  );
});
