import { describe, it, expect } from "vitest";
import {
  getRouteCode,
  buildBoardHref,
  searchResultToPlannerLocation,
  filterSearchResultsForBoardMode,
  buildJourneyLegHref,
  buildJourneyLegDetailPath,
  formatPlannerLocationLabel,
  formatTimestamp,
  formatShortTime,
  formatShortDate,
  formatDurationMinutes,
  formatFreshnessLabel,
  DEFAULT_BUS_DATE,
  DEFAULT_TRAIN_FROM,
} from "../lib/transportApi";
import type { PlannerLocation, SearchResult, JourneyPlanResponse } from "../lib/transportApi";

describe("getRouteCode", () => {
  it("returns the last colon-separated segment", () => {
    expect(getRouteCode("op:region:42X")).toBe("42X");
  });
  it("returns the input unchanged when there is no colon", () => {
    expect(getRouteCode("42X")).toBe("42X");
  });
});

describe("buildBoardHref", () => {
  it("routes stations to the train board", () => {
    const loc: PlannerLocation = { type: "station", id: "s1", code: "LAN", name: "Lancaster" };
    const href = buildBoardHref(loc);
    expect(href).toContain("/location-info/train");
    expect(href).toContain(`crs=${encodeURIComponent("LAN")}`);
    expect(href).toContain(`from=${encodeURIComponent(DEFAULT_TRAIN_FROM)}`);
  });

  it("routes bus stop groups to the bus board with groupId", () => {
    const loc: PlannerLocation = {
      type: "bus_stop_group",
      id: "lancaster_bus_station",
      code: "lancaster_bus_station",
      name: "Lancaster Bus Station",
      localityName: "Lancaster City Centre",
    };
    const href = buildBoardHref(loc);
    expect(href).toContain("/location-info/bus");
    expect(href).toContain("groupId=lancaster_bus_station");
    expect(href).toContain(`date=${DEFAULT_BUS_DATE}`);
    expect(href).toContain("groupName=");
    expect(href).toContain("stopLocalityName=");
  });

  it("routes individual bus stops to the bus board with stopId", () => {
    const loc: PlannerLocation = { type: "bus_stop", id: "s2", code: "2500LA01", name: "High St" };
    const href = buildBoardHref(loc);
    expect(href).toContain("stopId=2500LA01");
    expect(href).toContain(`date=${DEFAULT_BUS_DATE}`);
  });

  it("appends the search query when provided", () => {
    const loc: PlannerLocation = { type: "station", id: "s1", code: "LAN", name: "Lancaster" };
    const href = buildBoardHref(loc, "lanca ster");
    expect(href).toContain(`q=${encodeURIComponent("lanca ster")}`);
  });
});

describe("searchResultToPlannerLocation", () => {
  it("copies the identifying fields", () => {
    const result: SearchResult = {
      type: "station",
      id: "s1",
      code: "LAN",
      name: "Lancaster",
      localityName: "Lancaster",
    } as SearchResult;
    expect(searchResultToPlannerLocation(result)).toEqual({
      type: "station",
      id: "s1",
      code: "LAN",
      name: "Lancaster",
      localityName: "Lancaster",
    });
  });
});

describe("filterSearchResultsForBoardMode", () => {
  const results: SearchResult[] = [
    { type: "station", id: "s1", code: "LAN", name: "Lancaster", localityName: null } as SearchResult,
    { type: "bus_stop", id: "b1", code: "2500LA01", name: "High St", localityName: null } as SearchResult,
    { type: "bus_stop_group", id: "g1", code: "g1", name: "Group", localityName: null } as SearchResult,
  ];

  it("returns only stations for rail mode", () => {
    const filtered = filterSearchResultsForBoardMode(results, "rail");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe("station");
  });

  it("returns bus stops and groups for bus mode", () => {
    const filtered = filterSearchResultsForBoardMode(results, "bus");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.type).sort()).toEqual(["bus_stop", "bus_stop_group"]);
  });
});

describe("buildJourneyLegHref / buildJourneyLegDetailPath", () => {
  const railLeg = {
    mode: "rail",
    scheduleId: "sched-1",
    from: { id: "LAN", name: "Lancaster" },
    to: { id: "PRE", name: "Preston" },
    line: null,
    operator: "Avanti",
    routeId: null,
  } as unknown as JourneyPlanResponse["itineraries"][number]["legs"][number];

  it("produces a legs href including mode, fromId, toId", () => {
    const href = buildJourneyLegHref(railLeg);
    expect(href.startsWith("/journeys/leg?")).toBe(true);
    expect(href).toContain("mode=rail");
    expect(href).toContain("fromId=LAN");
    expect(href).toContain("toId=PRE");
    expect(href).toContain("operator=Avanti");
  });

  it("returns a detail path for rail legs with a scheduleId", () => {
    const path = buildJourneyLegDetailPath(railLeg);
    expect(path).not.toBeNull();
    expect(path!).toContain("/journeys/legs/detail?");
    expect(path!).toContain("scheduleId=sched-1");
  });

  it("returns null for walk legs", () => {
    const walkLeg = { ...railLeg, mode: "walk" } as typeof railLeg;
    expect(buildJourneyLegDetailPath(walkLeg)).toBeNull();
  });

  it("returns null when scheduleId is missing", () => {
    const noSched = { ...railLeg, scheduleId: null } as typeof railLeg;
    expect(buildJourneyLegDetailPath(noSched)).toBeNull();
  });
});

describe("formatPlannerLocationLabel", () => {
  it("returns an empty string for null", () => {
    expect(formatPlannerLocationLabel(null)).toBe("");
  });

  it("includes code for station and bus_stop", () => {
    const loc: PlannerLocation = { type: "station", id: "s", code: "LAN", name: "Lancaster" };
    expect(formatPlannerLocationLabel(loc)).toBe("Lancaster (LAN)");
  });

  it("appends locality when present", () => {
    const loc: PlannerLocation = {
      type: "bus_stop",
      id: "b",
      code: "2500LA01",
      name: "High St",
      localityName: "Lancaster",
    };
    expect(formatPlannerLocationLabel(loc)).toBe("High St, Lancaster (2500LA01)");
  });

  it("omits the code for bus_stop_group", () => {
    const loc: PlannerLocation = {
      type: "bus_stop_group",
      id: "g",
      code: "g",
      name: "Lancaster Bus Station",
      localityName: "Lancaster City Centre",
    };
    expect(formatPlannerLocationLabel(loc)).toBe("Lancaster Bus Station, Lancaster City Centre");
  });
});

describe("formatTimestamp / formatShortTime / formatShortDate", () => {
  it("formatTimestamp returns 'Unknown' for null", () => {
    expect(formatTimestamp(null)).toBe("Unknown");
  });

  it("formatShortTime recognises HH:MM", () => {
    expect(formatShortTime("08:30")).toBe("08:30");
  });

  it("formatShortTime recognises HHMM", () => {
    expect(formatShortTime("0830")).toBe("08:30");
  });

  it("formatShortTime returns the input when it isn't a time", () => {
    expect(formatShortTime("nonsense")).toBe("nonsense");
  });

  it("formatShortDate returns 'Unknown' for null", () => {
    expect(formatShortDate(null)).toBe("Unknown");
  });
});

describe("formatDurationMinutes", () => {
  it("formats sub-hour durations in minutes", () => {
    expect(formatDurationMinutes(0)).toBe("0 min");
    expect(formatDurationMinutes(45)).toBe("45 min");
  });

  it("formats exact-hour durations without a trailing zero", () => {
    expect(formatDurationMinutes(60)).toBe("1h");
    expect(formatDurationMinutes(120)).toBe("2h");
  });

  it("combines hours and minutes", () => {
    expect(formatDurationMinutes(95)).toBe("1h 35m");
  });

  it("returns 'Unknown' for negative or non-finite values", () => {
    expect(formatDurationMinutes(-1)).toBe("Unknown");
    expect(formatDurationMinutes(Number.NaN)).toBe("Unknown");
  });
});

describe("formatFreshnessLabel", () => {
  const base = Date.UTC(2026, 3, 19, 12, 0, 0);
  const minutesAgo = (m: number) => new Date(base - m * 60_000).toISOString();

  it("returns 'unknown' when the timestamp is null", () => {
    expect(formatFreshnessLabel(null, base).tone).toBe("unknown");
  });

  it("returns 'unknown' for a malformed timestamp", () => {
    expect(formatFreshnessLabel("not-a-date", base).tone).toBe("unknown");
  });

  it("classifies <1m as fresh", () => {
    expect(formatFreshnessLabel(minutesAgo(0), base)).toEqual({ label: "Fresh now", tone: "fresh" });
  });

  it("classifies 1-2m as fresh with minute count", () => {
    expect(formatFreshnessLabel(minutesAgo(2), base).tone).toBe("fresh");
  });

  it("classifies 3-7m as aging", () => {
    expect(formatFreshnessLabel(minutesAgo(5), base).tone).toBe("aging");
  });

  it("classifies >=8m as stale", () => {
    expect(formatFreshnessLabel(minutesAgo(12), base).tone).toBe("stale");
  });
});
