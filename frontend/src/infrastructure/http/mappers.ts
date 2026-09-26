import type { Place } from "@/application/ports";
import type { Listing, ListingsPage, RankedListing } from "@/domain/listing";
import type { RefreshStatus } from "@/domain/refresh";
import type { SystemStatus } from "@/domain/system";
import type { ListingDto, ListingsDto, PlaceDto, RefreshStatusDto, SystemStatusDto } from "./dto";

const toDate = (iso: string | undefined): Date | undefined => (iso ? new Date(iso) : undefined);

export function toListingsPage(dto: ListingsDto): ListingsPage {
  return {
    items: dto.items.flatMap(toRankedListing),
    unlocated: dto.unlocated.map(toListing),
    counts: dto.counts,
  };
}

function toListing(dto: ListingDto): Listing {
  const { location } = dto;
  return {
    id: dto.id,
    text: dto.text,
    kind: dto.kind,
    origin: dto.origin,
    price: dto.price ?? undefined,
    priceSource: dto.priceSource ?? undefined,
    permalink: dto.permalink,
    author: dto.author,
    postedAt: toDate(dto.postedAt),
    location: location ? { point: { lat: location.lat, lng: location.lng }, place: location.place, source: location.source } : undefined,
  };
}

function toRankedListing(dto: ListingDto): RankedListing[] {
  const listing = toListing(dto);
  return listing.location ? [{ listing: { ...listing, location: listing.location }, distanceKm: dto.distanceKm }] : [];
}

export const toPlace = ({ lat, lng, name }: PlaceDto): Place => ({ point: { lat, lng }, name });

export const toSystemStatus = ({ lastRefreshedAt, ...status }: SystemStatusDto): SystemStatus => ({
  ...status,
  lastRefreshedAt: toDate(lastRefreshedAt),
});

export function toRefreshStatus(dto: RefreshStatusDto): RefreshStatus {
  switch (dto.state) {
    case "idle":
      return { state: "idle" };
    case "running":
      return { state: "running", phase: dto.phase, done: dto.done, total: dto.total };
    case "done":
      return {
        state: "done",
        finishedAt: new Date(dto.finishedAt),
        postsFound: dto.postsFound,
        added: dto.added,
        located: dto.located,
        commentsRead: dto.commentsRead,
        geocodeLimitReached: dto.geocodeLimitReached,
        commentLimitReached: dto.commentLimitReached,
        commentsError: dto.commentsError,
      };
    case "error":
      return { state: "error", message: dto.message };
  }
}
