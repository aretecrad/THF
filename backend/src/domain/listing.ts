import type { GeoPoint } from "./geo-point.js";

export type ListingKind = "sale" | "rent" | "sale/rent";
export type KindFilter = "all" | "sale" | "rent";

export type DetailSource = "text" | "comment";

export interface ListingLocation {
  readonly point: GeoPoint;
  readonly place?: string;
  readonly source: "tag" | DetailSource;
}

export interface Listing {
  readonly id: string;
  readonly text: string;
  readonly kind: ListingKind;
  readonly origin: "post" | "comment";
  readonly price?: string;
  readonly priceSource?: DetailSource;
  readonly permalink?: string;
  readonly author?: string;
  readonly postedAt?: Date;
  readonly fetchedAt: Date;
  readonly location?: ListingLocation;
}

export type LocatedListing = Listing & { readonly location: ListingLocation };

export const isLocated = (listing: Listing): listing is LocatedListing => listing.location !== undefined;

export const hasAllDetails = (listing: Listing): boolean => listing.price !== undefined && listing.location !== undefined;

export const matchesKind = (listing: Listing, filter: KindFilter): boolean =>
  filter === "all" || listing.kind === filter || listing.kind === "sale/rent";

export const postedSince = (listing: Listing, cutoff: Date): boolean => !listing.postedAt || listing.postedAt >= cutoff;

export const newestFirst = (a: Listing, b: Listing): number =>
  (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0);
