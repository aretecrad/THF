import type { GeoPoint } from "./geo";

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
  readonly location?: ListingLocation;
}

export type LocatedListing = Listing & { readonly location: ListingLocation };

export interface RankedListing {
  readonly listing: LocatedListing;
  readonly distanceKm: number | null;
}

export interface ListingsPage {
  readonly items: readonly RankedListing[];
  readonly unlocated: readonly Listing[];
  readonly counts: {
    readonly matching: number;
    readonly located: number;
    readonly withinRadius: number | null;
  };
}
