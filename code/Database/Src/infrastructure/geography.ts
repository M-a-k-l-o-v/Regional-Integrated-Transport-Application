// Lancashire geographic bounding box.
// Vehicles / coordinates outside this box are from a different region.
// The transport server SIRI endpoint does not reliably filter by operatorRef,
// so we enforce this boundary at the application layer.
export const LANCASHIRE_BOUNDS = {
  minLat: 53.5,
  maxLat: 54.35,
  minLon: -3.25,
  maxLon: -2.0,
} as const;

export function isInLancashire(lat: number | null, lon: number | null): boolean {
  if (lat === null || lon === null) return false;
  return (
    lat >= LANCASHIRE_BOUNDS.minLat &&
    lat <= LANCASHIRE_BOUNDS.maxLat &&
    lon >= LANCASHIRE_BOUNDS.minLon &&
    lon <= LANCASHIRE_BOUNDS.maxLon
  );
}
