export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

const COORDINATE_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const isValidGeoPoint = ({ lat, lng }: GeoPoint): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function parseGeoPoint(text: string): GeoPoint | null {
  const match = COORDINATE_PAIR.exec(text);
  if (!match) return null;
  const point = { lat: Number(match[1]), lng: Number(match[2]) };
  return isValidGeoPoint(point) ? point : null;
}
