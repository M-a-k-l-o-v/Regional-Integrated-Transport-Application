import { describe, it, expect } from "vitest";
import {
  normaliseStationText,
  extractStationTokens,
  isFrontageStopName,
  matchesStationFrontageStop,
  scoreStationFrontageStop,
} from "../services/stations/stationFrontageMatching";

describe("normaliseStationText", () => {
  it("lowercases, collapses whitespace, and strips punctuation", () => {
    expect(normaliseStationText("Lancaster (Main) Rail-Station!")).toBe("lancaster main rail station");
  });

  it("preserves ampersands and alphanumerics", () => {
    expect(normaliseStationText("Marks & Spencer")).toBe("marks & spencer");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normaliseStationText("   ")).toBe("");
  });
});

describe("extractStationTokens", () => {
  it("drops stop-words and tokens shorter than 4 characters", () => {
    const tokens = extractStationTokens("Lancaster North Station");
    expect(tokens).toContain("lancaster");
    expect(tokens).not.toContain("north");
    expect(tokens).not.toContain("station");
  });

  it("returns tokens in lowercase", () => {
    expect(extractStationTokens("PRESTON")).toEqual(["preston"]);
  });

  it("handles punctuation and multi-word names", () => {
    const tokens = extractStationTokens("Oxenholme Lake District");
    expect(tokens).toContain("oxenholme");
    expect(tokens).toContain("lake");
    expect(tokens).toContain("district");
  });
});

describe("isFrontageStopName", () => {
  it("matches stops whose name contains a frontage term", () => {
    expect(isFrontageStopName("Lancaster Rail Station")).toBe(true);
    expect(isFrontageStopName("Preston Railway Station")).toBe(true);
    expect(isFrontageStopName("Oxenholme Station")).toBe(true);
  });

  it("excludes non-rail 'station' facilities", () => {
    expect(isFrontageStopName("Lancaster Bus Station")).toBe(false);
    expect(isFrontageStopName("Preston Police Station")).toBe(false);
    expect(isFrontageStopName("Morecambe Fire Station")).toBe(false);
    expect(isFrontageStopName("Lancaster Ambulance Station")).toBe(false);
  });

  it("returns false when no frontage term is present", () => {
    expect(isFrontageStopName("Market Square")).toBe(false);
  });
});

describe("matchesStationFrontageStop", () => {
  it("matches when any token appears in the stop name", () => {
    expect(matchesStationFrontageStop(["lancaster"], "Lancaster Rail Station")).toBe(true);
  });

  it("matches against the locality name as a fallback", () => {
    expect(matchesStationFrontageStop(["preston"], "Railway Station", "Preston")).toBe(true);
  });

  it("returns false when no token is present in either haystack", () => {
    expect(matchesStationFrontageStop(["oxenholme"], "Market Square", "Kendal")).toBe(false);
  });

  it("tolerates a null locality", () => {
    expect(matchesStationFrontageStop(["lancaster"], "Lancaster Rail Station", null)).toBe(true);
  });
});

describe("scoreStationFrontageStop", () => {
  it("gives a high score when the full station name appears in the stop name", () => {
    const score = scoreStationFrontageStop("Lancaster", "Lancaster Rail Station", "Lancaster");
    // 12 (station in stop) + 4 (station in locality) + 5 (rail station) + 2 (station) = 23
    expect(score).toBeGreaterThanOrEqual(20);
  });

  it("gives a lower score when only locality matches", () => {
    const exact = scoreStationFrontageStop("Lancaster", "Lancaster Rail Station", "Lancaster");
    const localityOnly = scoreStationFrontageStop("Lancaster", "Market Square", "Lancaster");
    expect(exact).toBeGreaterThan(localityOnly);
  });

  it("returns 0 for a completely unrelated stop", () => {
    expect(scoreStationFrontageStop("Oxenholme Lake District", "Market Square", "Kendal")).toBe(0);
  });

  it("awards per-token bonuses for distinctive tokens present in the stop", () => {
    // "oxenholme" is a distinctive token (len>=4, not a stop-word)
    const score = scoreStationFrontageStop("Oxenholme Lake District", "Oxenholme Village Hall", "Kendal");
    // full name not present, but "oxenholme" token is in stop (+3), "lake" (+0, not present), "district" (+0)
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("treats locality hits as worth less than stop-name hits", () => {
    const stopHit = scoreStationFrontageStop("Oxenholme Lake District", "Oxenholme Village", "Kendal");
    const localityHit = scoreStationFrontageStop("Oxenholme Lake District", "Village Hall", "Oxenholme");
    expect(stopHit).toBeGreaterThan(localityHit);
  });
});
