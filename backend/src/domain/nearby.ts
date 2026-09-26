import { distanceKm, type GeoPoint } from "./geo-point.js";
import type { LocatedListing } from "./listing.js";

interface RankedListing {
  readonly listing: LocatedListing;
  readonly distanceKm: number;
}

export function rankByDistance(listings: readonly LocatedListing[], center: GeoPoint, radiusKm: number): RankedListing[] {
  return listings
    .map((listing) => ({ listing, distanceKm: Math.round(distanceKm(center, listing.location.point) * 10) / 10 }))
    .filter((ranked) => ranked.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
