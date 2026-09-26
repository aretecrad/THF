import { ValidationError } from "./errors.js";

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_DIAMETER_KM = 12_742;
const COORDINATE_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export function createGeoPoint(lat: number, lng: number): GeoPoint {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) throw new ValidationError(`Latitude must be between -90 and 90, got ${lat}.`);
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) throw new ValidationError(`Longitude must be between -180 and 180, got ${lng}.`);
  return { lat, lng };
}

export function parseGeoPoint(text: string): GeoPoint | null {
  const match = COORDINATE_PAIR.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRadians = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * toRadians) / 2) ** 2 +
    Math.cos(a.lat * toRadians) * Math.cos(b.lat * toRadians) * Math.sin(((b.lng - a.lng) * toRadians) / 2) ** 2;
  return EARTH_DIAMETER_KM * Math.asin(Math.sqrt(h));
}
