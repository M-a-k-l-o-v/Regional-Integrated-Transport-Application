import { describe, it, expect } from "vitest";
import { StationFacilitiesService } from "../services/stations/StationFacilitiesService";

describe("StationFacilitiesService", () => {
  const svc = new StationFacilitiesService();

  it("returns facilities for a known CRS", () => {
    const snap = svc.getFacilities("LAN");
    expect(snap.crs).toBe("LAN");
    expect(snap.facilities?.name).toBe("Lancaster");
    expect(snap.facilities?.staffed).toBe(true);
  });

  it("uppercases and trims the CRS lookup", () => {
    const snap = svc.getFacilities("  pre  ");
    expect(snap.crs).toBe("PRE");
    expect(snap.facilities?.name).toBe("Preston");
  });

  it("returns null facilities for an unknown CRS without throwing", () => {
    const snap = svc.getFacilities("ZZZ");
    expect(snap.crs).toBe("ZZZ");
    expect(snap.facilities).toBeNull();
  });

  it("produces an ISO 8601 fetchedAt timestamp", () => {
    const snap = svc.getFacilities("LAN");
    expect(snap.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns coherent data: unstaffed stations have no ticket-office hours", () => {
    const snap = svc.getFacilities("LEY");
    expect(snap.facilities?.staffed).toBe(false);
    expect(snap.facilities?.ticketOffice.available).toBe(false);
    expect(snap.facilities?.ticketOffice.hours).toBeNull();
  });

  it("exposes accessibility flags on a fully accessible station", () => {
    const snap = svc.getFacilities("BPN");
    expect(snap.facilities?.accessibility.stepFreeAccess).toBe("full");
    expect(snap.facilities?.accessibility.accessibleToilet).toBe(true);
    expect(snap.facilities?.accessibility.inductionLoop).toBe(true);
  });

  it("partial step-free stations surface a descriptive note", () => {
    const snap = svc.getFacilities("LEY");
    expect(snap.facilities?.accessibility.stepFreeAccess).toBe("partial");
    expect(snap.facilities?.accessibility.stepFreeNote).toBeTruthy();
  });

  it("is a pure function of its input: repeat lookups are consistent", () => {
    const a = svc.getFacilities("LAN").facilities;
    const b = svc.getFacilities("LAN").facilities;
    expect(a).toEqual(b);
  });
});
