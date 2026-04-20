import { describe, it, expect, beforeEach } from "vitest";
import { readRecentBoards, recordRecentBoard } from "../lib/boardHistory";

describe("boardHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("readRecentBoards returns an empty array when nothing is stored", () => {
    expect(readRecentBoards()).toEqual([]);
  });

  it("recordRecentBoard persists an entry with a viewedAt timestamp", () => {
    recordRecentBoard({
      mode: "rail",
      href: "/location-info/train?crs=LAN",
      location: { type: "station", id: "LAN", code: "LAN", name: "Lancaster" },
    });

    const boards = readRecentBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].mode).toBe("rail");
    expect(boards[0].location.code).toBe("LAN");
    expect(typeof boards[0].viewedAt).toBe("string");
    expect(Number.isNaN(new Date(boards[0].viewedAt).getTime())).toBe(false);
  });

  it("deduplicates by mode + location type + location id (most recent wins)", () => {
    const common = {
      mode: "rail" as const,
      location: { type: "station" as const, id: "LAN", code: "LAN", name: "Lancaster" },
    };
    recordRecentBoard({ ...common, href: "/first" });
    recordRecentBoard({ ...common, href: "/second" });

    const boards = readRecentBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].href).toBe("/second");
  });

  it("orders most-recent first", () => {
    recordRecentBoard({
      mode: "rail",
      href: "/lan",
      location: { type: "station", id: "LAN", code: "LAN", name: "Lancaster" },
    });
    recordRecentBoard({
      mode: "bus",
      href: "/pbs",
      location: { type: "bus_stop_group", id: "preston_bus_station", code: "preston_bus_station", name: "Preston Bus Station" },
    });

    const boards = readRecentBoards();
    expect(boards[0].mode).toBe("bus");
    expect(boards[1].mode).toBe("rail");
  });

  it("caps the history at 8 entries", () => {
    for (let i = 0; i < 12; i++) {
      recordRecentBoard({
        mode: "rail",
        href: `/station-${i}`,
        location: { type: "station", id: `S${i}`, code: `S${i}`, name: `Station ${i}` },
      });
    }
    const boards = readRecentBoards();
    expect(boards).toHaveLength(8);
    // Most-recent first: the last-added (index 11) should be first.
    expect(boards[0].location.id).toBe("S11");
  });

  it("ignores malformed JSON in storage", () => {
    window.localStorage.setItem("rit.recentBoards", "{ not json");
    expect(readRecentBoards()).toEqual([]);
  });

  it("filters out invalid entries from storage", () => {
    const mixed = [
      { mode: "rail", href: "/ok", viewedAt: new Date().toISOString(), location: { type: "station", id: "LAN", code: "LAN", name: "Lancaster" } },
      { mode: "bogus", href: "/bad", viewedAt: "today", location: { type: "other" } },
      "not an object",
    ];
    window.localStorage.setItem("rit.recentBoards", JSON.stringify(mixed));
    const boards = readRecentBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].location.code).toBe("LAN");
  });
});
