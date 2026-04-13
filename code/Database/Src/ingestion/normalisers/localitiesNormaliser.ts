import { parse } from "csv-parse/sync";

export type NormalisedLocality = {
  localityId: string;
  name: string;
  parentId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Convert British National Grid (OSGB36) Easting/Northing to WGS84 latitude/longitude.
 *
 * This is a lightweight implementation suitable for mapping / display.
 * If conversion fails, return null.
 */
function osgb36ToWgs84(easting: number, northing: number): { lat: number; lon: number } | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;

  // Airy 1830 major & minor semi-axes
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = (49 * Math.PI) / 180;
  const lon0 = (-2 * Math.PI) / 180;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);

  let lat = lat0;
  let M = 0;

  // Iterate to find initial latitude
  do {
    lat = (northing - N0 - M) / (a * F0) + lat;

    const Ma = (1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (lat - lat0);
    const Mb = (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
    const Mc = ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
    const Md = (35 / 24) * n ** 3 * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));

    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (Math.abs(northing - N0 - M) >= 0.00001);

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const tanLat = Math.tan(lat);
  const secLat = 1 / cosLat;

  const VII = tanLat / (2 * rho * nu);
  const VIII = (tanLat / (24 * rho * nu ** 3)) * (5 + 3 * tanLat ** 2 + eta2 - 9 * tanLat ** 2 * eta2);
  const IX = (tanLat / (720 * rho * nu ** 5)) * (61 + 90 * tanLat ** 2 + 45 * tanLat ** 4);

  const X = secLat / nu;
  const XI = (secLat / (6 * nu ** 3)) * (nu / rho + 2 * tanLat ** 2);
  const XII = (secLat / (120 * nu ** 5)) * (5 + 28 * tanLat ** 2 + 24 * tanLat ** 4);
  const XIIA = (secLat / (5040 * nu ** 7)) * (61 + 662 * tanLat ** 2 + 1320 * tanLat ** 4 + 720 * tanLat ** 6);

  const dE = easting - E0;

  const latOsgb = lat - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6;
  const lonOsgb = lon0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7;

  // Helmert transform OSGB36 -> WGS84 (approx)
  // Parameters: https://www.ordnancesurvey.co.uk/documents/resources/guide-coordinate-systems-great-britain.pdf
  const tx = 446.448;
  const ty = -125.157;
  const tz = 542.06;
  const s = 0.0000204894;
  const rx = (0.1502 / 3600) * (Math.PI / 180);
  const ry = (0.247 / 3600) * (Math.PI / 180);
  const rz = (0.8421 / 3600) * (Math.PI / 180);

  const aO = 6377563.396;
  const bO = 6356256.909;
  const e2O = 1 - (bO * bO) / (aO * aO);

  // Convert OSGB36 lat/lon to cartesian
  const sinPhi = Math.sin(latOsgb);
  const cosPhi = Math.cos(latOsgb);
  const sinLam = Math.sin(lonOsgb);
  const cosLam = Math.cos(lonOsgb);

  const nuO = aO / Math.sqrt(1 - e2O * sinPhi * sinPhi);
  const H = 0; // assume sea level

  const x1 = (nuO + H) * cosPhi * cosLam;
  const y1 = (nuO + H) * cosPhi * sinLam;
  const z1 = ((1 - e2O) * nuO + H) * sinPhi;

  // Apply Helmert
  const x2 = tx + (1 + s) * x1 + (-rz) * y1 + ry * z1;
  const y2 = ty + rz * x1 + (1 + s) * y1 + (-rx) * z1;
  const z2 = tz + (-ry) * x1 + rx * y1 + (1 + s) * z1;

  // Convert cartesian to WGS84 lat/lon
  const aW = 6378137.0;
  const bW = 6356752.3141;
  const e2W = 1 - (bW * bW) / (aW * aW);

  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let phi = Math.atan2(z2, p * (1 - e2W));
  let phiPrev = 0;

  while (Math.abs(phi - phiPrev) > 1e-12) {
    phiPrev = phi;
    const nuW = aW / Math.sqrt(1 - e2W * Math.sin(phi) ** 2);
    phi = Math.atan2(z2 + e2W * nuW * Math.sin(phi), p);
  }

  const lambda = Math.atan2(y2, x2);

  return { lat: (phi * 180) / Math.PI, lon: (lambda * 180) / Math.PI };
}

export function normaliseLocalities(csvText: string): NormalisedLocality[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  // Real header (DfT):
  // NptgLocalityCode, LocalityName, ParentLocalityName, Easting, Northing, ...
  return records
    .map((r) => {
      const localityId = r.NptgLocalityCode;
      const name = r.LocalityName;

      // NOTE: API provides ParentLocalityName (name), not a parent code.
      // Keep parentId null unless your schema stores parent by name.
      const parentName = r.ParentLocalityName;

      const easting = r.Easting ? Number(r.Easting) : NaN;
      const northing = r.Northing ? Number(r.Northing) : NaN;
      const ll = osgb36ToWgs84(easting, northing);

      if (!localityId || !name) return null;

      return {
        localityId: String(localityId),
        name: String(name),
        parentId: parentName ? String(parentName) : null,
        latitude: ll ? ll.lat : null,
        longitude: ll ? ll.lon : null,
      };
    })
    .filter(Boolean) as NormalisedLocality[];
}