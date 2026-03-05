import { parse } from "csv-parse/sync";

export type NormalisedAccessNode = {
  stopId: string;              // ATCOCode (BusStop primary key)
  name: string;
  latitude: number | null;
  longitude: number | null;
  localityId: string | null;   // NptgLocalityCode if present
  stopType: string | null;     // e.g. StopType / NodeType
};



export function normaliseAccessNodes(csvText: string): NormalisedAccessNode[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records
    .map((r) => {
      // We’ll confirm exact header names after first fetch, but this is a robust start.
      const atco =
        r.AtcoCode ?? r.ATCOCode ?? r.atcoCode ?? r["AtcoCode"];

      const name =
        r.CommonName ?? r.Name ?? r.StopName ?? r.commonName ?? r["CommonName"];

      const latRaw = r.Latitude ?? r.lat ?? r["Latitude"];
      const lonRaw = r.Longitude ?? r.lon ?? r["Longitude"];

      // NPTG locality code is often included on NaPTAN records (sometimes called NptgLocalityCode / LocalityCode)
      const locality =
        r.NptgLocalityCode ?? r.LocalityCode ?? r.localityId ?? null;

      const stopType =
        r.StopType ?? r.NodeType ?? r.StopClassification ?? null;

      if (!atco || !name) return null;

      /* ===== BUS STOP DOMAIN OBJECT =====
         Access Nodes are NaPTAN bus stops.
         These map to BusStop (NOT Station).
      ===== END BUS STOP DOMAIN OBJECT ===== */
      return {
        stopId: String(atco),
        name: String(name),
        latitude: latRaw ? Number(latRaw) : null,
        longitude: lonRaw ? Number(lonRaw) : null,
        localityId: locality ? String(locality) : null,
        stopType: stopType ? String(stopType) : null,
      };
    })
    .filter(Boolean) as NormalisedAccessNode[];
}