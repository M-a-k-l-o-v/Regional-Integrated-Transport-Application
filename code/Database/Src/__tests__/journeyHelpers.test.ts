import { describe, it, expect } from "vitest";
import {
  toNodeId,
  getLocalDayRange,
  parsePlannerDateTime,
  getDayIndexMondayZero,
  parseRailTimeToMinutes,
  minutesToDate,
  haversineDistanceMetres,
  getRouteCode,
  getBusServiceLabel,
  scoreLabel,
  formatPlannerIso,
} from "../services/journeys/helpers";
import type { SearchLabel } from "../services/journeys/types";

describe("toNodeId", () => {
  it("combines type and id with a colon", () => {
    expect(toNodeId("station", "PRE")).toBe("station:PRE");
    expect(toNodeId("bus_stop", "2500LAC12345")).toBe("bus_stop:2500LAC12345");
    expect(toNodeId("bus_stop_group", "lancaster-centre")).toBe("bus_stop_group:lancaster-centre");
  });
});

describe("getLocalDayRange", () => {
  it("returns midnight-to-midnight for a valid date", () => {
    const { dayStart, nextDayStart } = getLocalDayRange("2026-04-19");
    expect(dayStart.getFullYear()).toBe(2026);
    expect(dayStart.getMonth()).toBe(3);
    expect(dayStart.getDate()).toBe(19);
    expect(dayStart.getHours()).toBe(0);
    expect(nextDayStart.getDate()).toBe(20);
    expect(nextDayStart.getTime() - dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("handles month rollover", () => {
    const { nextDayStart } = getLocalDayRange("2026-04-30");
    expect(nextDayStart.getMonth()).toBe(4);
    expect(nextDayStart.getDate()).toBe(1);
  });

  it("throws on an invalid date string", () => {
    expect(() => getLocalDayRange("not-a-date")).toThrow(/Invalid planner date/);
  });
});

describe("parsePlannerDateTime", () => {
  it("parses a valid date + HH:MM pair", () => {
    const d = parsePlannerDateTime("2026-04-19", "08:30");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(0);
  });

  it("throws when the date is invalid", () => {
    expect(() => parsePlannerDateTime("not-a-date", "08:30")).toThrow(/Invalid planner datetime/);
  });

  it("throws when the time is invalid", () => {
    expect(() => parsePlannerDateTime("2026-04-19", "99:99")).toThrow(/Invalid planner datetime/);
  });
});

describe("getDayIndexMondayZero", () => {
  it("maps Monday to 0 through Sunday to 6", () => {
    // 2026-04-13 is a Monday.
    expect(getDayIndexMondayZero(new Date("2026-04-13T12:00:00"))).toBe(0);
    expect(getDayIndexMondayZero(new Date("2026-04-14T12:00:00"))).toBe(1);
    expect(getDayIndexMondayZero(new Date("2026-04-15T12:00:00"))).toBe(2);
    expect(getDayIndexMondayZero(new Date("2026-04-16T12:00:00"))).toBe(3);
    expect(getDayIndexMondayZero(new Date("2026-04-17T12:00:00"))).toBe(4);
    expect(getDayIndexMondayZero(new Date("2026-04-18T12:00:00"))).toBe(5);
    expect(getDayIndexMondayZero(new Date("2026-04-19T12:00:00"))).toBe(6);
  });
});

describe("parseRailTimeToMinutes", () => {
  it("parses a valid 4-digit time", () => {
    expect(parseRailTimeToMinutes("0830")).toBe(8 * 60 + 30);
    expect(parseRailTimeToMinutes("0000")).toBe(0);
    expect(parseRailTimeToMinutes("2359")).toBe(23 * 60 + 59);
  });

  it("accepts the CIF extended range past midnight (up to 47:59)", () => {
    expect(parseRailTimeToMinutes("2500")).toBe(25 * 60);
    expect(parseRailTimeToMinutes("4759")).toBe(47 * 60 + 59);
  });

  it("ignores trailing characters after the first 4 digits", () => {
    expect(parseRailTimeToMinutes("0830H")).toBe(8 * 60 + 30);
  });

  it("rejects out-of-range hours or minutes", () => {
    expect(parseRailTimeToMinutes("4800")).toBeNull();
    expect(parseRailTimeToMinutes("1060")).toBeNull();
  });

  it("returns null for null / undefined / empty / malformed input", () => {
    expect(parseRailTimeToMinutes(null)).toBeNull();
    expect(parseRailTimeToMinutes(undefined)).toBeNull();
    expect(parseRailTimeToMinutes("")).toBeNull();
    expect(parseRailTimeToMinutes("abcd")).toBeNull();
    expect(parseRailTimeToMinutes("12")).toBeNull();
  });
});

describe("minutesToDate", () => {
  it("anchors the date to midnight + minutes, ignoring the base time", () => {
    const base = new Date("2026-04-19T15:47:31.500");
    const result = minutesToDate(base, 8 * 60 + 30);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("does not mutate the input date", () => {
    const base = new Date("2026-04-19T15:47:31");
    const originalMs = base.getTime();
    minutesToDate(base, 60);
    expect(base.getTime()).toBe(originalMs);
  });
});

describe("haversineDistanceMetres", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceMetres(54.047, -2.801, 54.047, -2.801)).toBe(0);
  });

  it("approximates a known distance: Lancaster to Preston (~31 km)", () => {
    // Lancaster: 54.0465, -2.8007 ; Preston: 53.7632, -2.7031
    const d = haversineDistanceMetres(54.0465, -2.8007, 53.7632, -2.7031);
    expect(d).toBeGreaterThan(30_000);
    expect(d).toBeLessThan(33_000);
  });

  it("is symmetric", () => {
    const a = haversineDistanceMetres(54.0, -2.8, 53.76, -2.7);
    const b = haversineDistanceMetres(53.76, -2.7, 54.0, -2.8);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe("getRouteCode", () => {
  it("returns the final colon-separated segment", () => {
    expect(getRouteCode("operator:region:42X")).toBe("42X");
    expect(getRouteCode("op:1")).toBe("1");
  });

  it("returns the input unchanged when there is no colon", () => {
    expect(getRouteCode("42X")).toBe("42X");
  });
});

describe("getBusServiceLabel", () => {
  it("prefers a trimmed lineRef when provided", () => {
    expect(getBusServiceLabel("  42X  ", "op:fallback")).toBe("42X");
  });

  it("takes the last colon segment of a qualified lineRef", () => {
    expect(getBusServiceLabel("op:region:42X", "op:fallback")).toBe("42X");
  });

  it("falls back to the routeId code when lineRef is missing or blank", () => {
    expect(getBusServiceLabel(null, "op:region:99")).toBe("99");
    expect(getBusServiceLabel(undefined, "op:99")).toBe("99");
    expect(getBusServiceLabel("   ", "op:99")).toBe("99");
  });
});

describe("scoreLabel", () => {
  const base: SearchLabel = {
    nodeId: "station:PRE",
    timeMs: 1_000_000,
    transfers: 2,
    walkingMinutes: 0,
    lastServiceKey: null,
    hasBoardedTransit: false,
    edges: [],
  };

  it("fastest weights transfers lightly (1 sec per transfer)", () => {
    expect(scoreLabel(base, "fastest")).toBe(1_000_000 + 2 * 1000);
  });

  it("balanced weights each transfer as 10 minutes", () => {
    expect(scoreLabel(base, "balanced")).toBe(1_000_000 + 2 * 10 * 60 * 1000);
  });

  it("fewest_changes prioritises transfer count above arrival time", () => {
    const few: SearchLabel = { ...base, transfers: 1, timeMs: 9_999_999 };
    const many: SearchLabel = { ...base, transfers: 2, timeMs: 0 };
    expect(scoreLabel(few, "fewest_changes")).toBeLessThan(scoreLabel(many, "fewest_changes"));
  });
});

describe("formatPlannerIso", () => {
  it("returns null for null input", () => {
    expect(formatPlannerIso(null)).toBeNull();
  });

  it("returns an ISO string for a valid epoch", () => {
    const iso = formatPlannerIso(Date.UTC(2026, 3, 19, 8, 30, 0));
    expect(iso).toBe("2026-04-19T08:30:00.000Z");
  });
});
