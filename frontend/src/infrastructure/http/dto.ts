export interface ListingDto {
  readonly id: string;
  readonly text: string;
  readonly kind: "sale" | "rent" | "sale/rent";
  readonly origin: "post" | "comment";
  readonly price: string | null;
  readonly priceSource: "text" | "comment" | null;
  readonly permalink?: string;
  readonly author?: string;
  readonly postedAt?: string;
  readonly location: {
    readonly lat: number;
    readonly lng: number;
    readonly place?: string;
    readonly source: "tag" | "text" | "comment";
  } | null;
  readonly distanceKm: number | null;
}

export interface ListingsDto {
  readonly items: readonly ListingDto[];
  readonly unlocated: readonly ListingDto[];
  readonly counts: { readonly matching: number; readonly located: number; readonly withinRadius: number | null };
}

export interface PlaceDto {
  readonly lat: number;
  readonly lng: number;
  readonly name: string;
}

export interface AccountDto {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
  readonly pictureUrl?: string;
  readonly threadsConnected: boolean;
}

export interface LoginOptionsDto {
  readonly threadsLogin: boolean;
}

export interface SystemStatusDto {
  readonly threadsConnected: boolean;
  readonly listings: number;
  readonly located: number;
  readonly lastRefreshedAt?: string;
}

export type RefreshStatusDto =
  | { readonly state: "idle" }
  | { readonly state: "running"; readonly phase: "searching" | "reading"; readonly done: number; readonly total: number }
  | {
      readonly state: "done";
      readonly finishedAt: string;
      readonly postsFound: number;
      readonly added: number;
      readonly located: number;
      readonly commentsRead: number;
      readonly geocodeLimitReached: boolean;
      readonly commentLimitReached: boolean;
      readonly commentsError?: string;
    }
  | { readonly state: "error"; readonly message: string };
