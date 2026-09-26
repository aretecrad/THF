import type { GeoPoint } from "../../domain/geo-point.js";
import { isLocated, matchesKind, newestFirst, postedSince, type KindFilter, type Listing, type LocatedListing } from "../../domain/listing.js";
import { rankByDistance } from "../../domain/nearby.js";
import { daysBefore } from "../../domain/time.js";
import type { Clock } from "../ports/clock.js";
import type { ListingRepository } from "../ports/listing-repository.js";

interface NearbyQuery {
  readonly center?: GeoPoint;
  readonly radiusKm: number;
  readonly kind: KindFilter;
  readonly days: number;
  readonly limit: number;
}

export interface NearbyResult {
  readonly items: ReadonlyArray<{ readonly listing: LocatedListing; readonly distanceKm: number | null }>;
  readonly unlocated: readonly Listing[];
  readonly counts: { readonly matching: number; readonly located: number; readonly withinRadius: number | null };
}

export class SearchNearbyListings {
  constructor(
    private readonly listings: ListingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, query: NearbyQuery): Promise<NearbyResult> {
    const cutoff = daysBefore(this.clock.now(), query.days);
    const matching = (await this.listings.findAll(userId)).filter((l) => matchesKind(l, query.kind) && postedSince(l, cutoff));
    const located = matching.filter(isLocated);
    const unlocated = matching.filter((listing) => !isLocated(listing)).sort(newestFirst).slice(0, query.limit);
    const counts = { matching: matching.length, located: located.length };

    if (!query.center) {
      const items = [...located].sort(newestFirst).slice(0, query.limit).map((listing) => ({ listing, distanceKm: null }));
      return { items, unlocated, counts: { ...counts, withinRadius: null } };
    }
    const ranked = rankByDistance(located, query.center, query.radiusKm);
    return { items: ranked.slice(0, query.limit), unlocated, counts: { ...counts, withinRadius: ranked.length } };
  }
}
