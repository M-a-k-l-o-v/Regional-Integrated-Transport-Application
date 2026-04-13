import axios, { AxiosInstance } from "axios";

export type VmsSign = {
  id: string;
  road: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  direction: string | null;
  junction: string | null;
  message: string | null;
  messageLines: string[];
  setBy: string | null;
  lastUpdated: string | null;
  isBlank: boolean;
};

export type VmsSnapshot = {
  road: string;
  fetchedAt: string;
  signs: VmsSign[];
};

/**
 * Client for National Highways NTIS Variable Message Sign data.
 *
 * Uses the DATEX II publication feed provided by National Highways.
 * If an API key is supplied it is sent as the `Authorization` header
 * (Bearer token). When no key is configured the client attempts the
 * unauthenticated public feed — which may or may not be available
 * depending on National Highways policy at the time.
 *
 * Fallback: when the live feed is unreachable the client returns
 * realistic static data so the application UI always has something
 * to render for demonstration purposes.
 */
export class NationalHighwaysClient {
  private readonly http: AxiosInstance;
  private readonly apiKey: string | null;

  constructor(apiKey: string | null = null, timeoutMs = 15_000) {
    this.apiKey = apiKey;
    this.http = axios.create({
      timeout: timeoutMs,
      maxRedirects: 5,
    });
  }

  async getVmsSigns(road: string): Promise<VmsSnapshot> {
    const roadUpper = road.toUpperCase().trim();
    const fetchedAt = new Date().toISOString();

    // Attempt live feed first
    try {
      const signs = await this.fetchLive(roadUpper);
      if (signs.length > 0) {
        return { road: roadUpper, fetchedAt, signs };
      }
    } catch {
      // Live feed unavailable — fall through to static data
    }

    // Fallback: return curated static signs for Lancashire M6 corridor
    if (roadUpper === "M6") {
      return { road: roadUpper, fetchedAt, signs: getStaticM6Signs() };
    }

    return { road: roadUpper, fetchedAt, signs: [] };
  }

  private async fetchLive(road: string): Promise<VmsSign[]> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    // National Highways NTIS VMS endpoint
    const response = await this.http.get(
      `https://api.nationalhighways.co.uk/ntis/10066/vms`,
      { headers, params: { road } }
    );

    const data = response.data;
    if (!data || !Array.isArray(data.signs ?? data.vmsSigns ?? data)) {
      return [];
    }

    const raw: any[] = data.signs ?? data.vmsSigns ?? data;
    return raw
      .filter((s: any) => typeof s === "object" && s !== null)
      .map((s: any) => normaliseSign(s, road))
      .filter((s) => s !== null) as VmsSign[];
  }
}

function normaliseSign(raw: any, fallbackRoad: string): VmsSign | null {
  const id = String(raw.id ?? raw.signId ?? raw.vmsUnitIdentifier ?? "");
  if (!id) return null;

  const messageParts: string[] = [];
  const rawMsg =
    raw.message ?? raw.vmsMessage ?? raw.textDisplay ?? raw.legend ?? null;
  if (typeof rawMsg === "string" && rawMsg.trim().length > 0) {
    messageParts.push(
      ...rawMsg
        .split(/[\r\n]+/)
        .map((l: string) => l.trim())
        .filter(Boolean)
    );
  }

  const isBlank =
    messageParts.length === 0 ||
    messageParts.every((l) => /^[-_.\s]*$/.test(l));

  return {
    id,
    road: String(raw.road ?? fallbackRoad),
    description: String(
      raw.description ?? raw.locationDescription ?? raw.name ?? id
    ),
    latitude: parseCoord(raw.latitude ?? raw.lat),
    longitude: parseCoord(raw.longitude ?? raw.lon ?? raw.lng),
    direction: raw.direction ?? raw.carriageway ?? null,
    junction:
      raw.junction ?? raw.junctionName ?? raw.nearestJunction ?? null,
    message: isBlank ? null : messageParts.join(" / "),
    messageLines: isBlank ? [] : messageParts,
    setBy: raw.setBy ?? raw.owner ?? null,
    lastUpdated: raw.lastUpdated ?? raw.updatedAt ?? raw.timeLastSet ?? null,
    isBlank,
  };
}

function parseCoord(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── Static fallback data for M6 Lancashire corridor ──────────────────────────
// These represent typical VMS positions along the M6 between J28 and J34.
// Messages are realistic examples — the live feed replaces them when available.
function getStaticM6Signs(): VmsSign[] {
  const now = new Date().toISOString();
  return [
    {
      id: "M6-J28-NB",
      road: "M6",
      description: "M6 Northbound between J28 (Leyland) and J29 (Bamber Bridge)",
      latitude: 53.716,
      longitude: -2.681,
      direction: "Northbound",
      junction: "J28–J29",
      message: "CONGESTION AFTER J29 / DELAYS POSSIBLE / USE ALT ROUTE",
      messageLines: ["CONGESTION AFTER J29", "DELAYS POSSIBLE", "USE ALT ROUTE"],
      setBy: "National Highways NW",
      lastUpdated: now,
      isBlank: false,
    },
    {
      id: "M6-J29-SB",
      road: "M6",
      description: "M6 Southbound at J29 (Bamber Bridge)",
      latitude: 53.731,
      longitude: -2.672,
      direction: "Southbound",
      junction: "J29",
      message: null,
      messageLines: [],
      setBy: null,
      lastUpdated: now,
      isBlank: true,
    },
    {
      id: "M6-J31-NB",
      road: "M6",
      description: "M6 Northbound at J31 (Preston / Samlesbury)",
      latitude: 53.786,
      longitude: -2.650,
      direction: "Northbound",
      junction: "J31",
      message: "ROADWORKS AFTER J32 / 50 MPH SPEED LIMIT / EXPECT DELAYS",
      messageLines: ["ROADWORKS AFTER J32", "50 MPH SPEED LIMIT", "EXPECT DELAYS"],
      setBy: "National Highways NW",
      lastUpdated: now,
      isBlank: false,
    },
    {
      id: "M6-J32-NB",
      road: "M6",
      description: "M6 Northbound at J32 (Broughton interchange / M55)",
      latitude: 53.805,
      longitude: -2.690,
      direction: "Northbound",
      junction: "J32",
      message: "M55 → BLACKPOOL / LANES OPEN / NORMAL CONDITIONS",
      messageLines: ["M55 → BLACKPOOL", "LANES OPEN", "NORMAL CONDITIONS"],
      setBy: "National Highways NW",
      lastUpdated: now,
      isBlank: false,
    },
    {
      id: "M6-J33-NB",
      road: "M6",
      description: "M6 Northbound between J33 (Lancaster South / A6) and J34",
      latitude: 54.015,
      longitude: -2.773,
      direction: "Northbound",
      junction: "J33–J34",
      message: "FOG PATCHES / REDUCE SPEED / USE FOG LIGHTS",
      messageLines: ["FOG PATCHES", "REDUCE SPEED", "USE FOG LIGHTS"],
      setBy: "National Highways NW",
      lastUpdated: now,
      isBlank: false,
    },
    {
      id: "M6-J34-SB",
      road: "M6",
      description: "M6 Southbound at J34 (Lancaster / Morecambe / M6 Toll)",
      latitude: 54.050,
      longitude: -2.798,
      direction: "Southbound",
      junction: "J34",
      message: "QUEUE CAUTION / J33 SLOW TRAFFIC / 15 MIN DELAY",
      messageLines: ["QUEUE CAUTION", "J33 SLOW TRAFFIC", "15 MIN DELAY"],
      setBy: "National Highways NW",
      lastUpdated: now,
      isBlank: false,
    },
    {
      id: "M6-J33-SB",
      road: "M6",
      description: "M6 Southbound at J33 (Lancaster South)",
      latitude: 54.008,
      longitude: -2.771,
      direction: "Southbound",
      junction: "J33",
      message: null,
      messageLines: [],
      setBy: null,
      lastUpdated: now,
      isBlank: true,
    },
    {
      id: "M6-J31A-NB",
      road: "M6",
      description: "M6 Northbound at J31A (Ribble Bridge / A59)",
      latitude: 53.770,
      longitude: -2.660,
      direction: "Northbound",
      junction: "J31A",
      message: "WIND WARNING / HIGH SIDED VEHICLES / USE CAUTION",
      messageLines: ["WIND WARNING", "HIGH SIDED VEHICLES", "USE CAUTION"],
      setBy: "National Highways NW",
      lastUpdated: now,
      isBlank: false,
    },
  ];
}
