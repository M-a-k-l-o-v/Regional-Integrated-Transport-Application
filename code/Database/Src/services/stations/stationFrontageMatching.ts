export const FRONTAGE_TERMS = ["rail station", "railway station", " station"];
export const FRONTAGE_EXCLUDED_TERMS = ["bus station", "police station", "ambulance station", "fire station"];
export const STATION_STOP_WORDS = new Set([
  "lancs",
  "north",
  "south",
  "east",
  "west",
  "central",
  "parkway",
  "road",
  "junction",
  "street",
  "station",
  "gate",
  "lane",
  "park",
  "hill",
]);

export function normaliseStationText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s&]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractStationTokens(name: string): string[] {
  return normaliseStationText(name)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STATION_STOP_WORDS.has(token));
}

export function isFrontageStopName(name: string): boolean {
  const lower = normaliseStationText(name);
  return FRONTAGE_TERMS.some((term) => lower.includes(term)) && !FRONTAGE_EXCLUDED_TERMS.some((term) => lower.includes(term));
}

export function matchesStationFrontageStop(tokens: string[], stopName: string, localityName?: string | null): boolean {
  const haystack = normaliseStationText(`${stopName} ${localityName ?? ""}`);
  return tokens.some((token) => haystack.includes(token));
}

export function scoreStationFrontageStop(stationName: string, stopName: string, localityName?: string | null): number {
  const station = normaliseStationText(stationName);
  const stop = normaliseStationText(stopName);
  const locality = normaliseStationText(localityName ?? "");
  const tokens = extractStationTokens(stationName);

  let score = 0;
  if (stop.includes(station)) score += 12;
  if (locality.includes(station)) score += 4;
  if (stop.includes("rail station") || stop.includes("railway station")) score += 5;
  if (stop.includes(" station")) score += 2;

  for (const token of tokens) {
    if (stop.includes(token)) score += 3;
    else if (locality.includes(token)) score += 1;
  }

  return score;
}
