import type { Place } from "../../application/ports/geocoder.js";
import type { RefreshStatus } from "../../application/refresh-job.js";
import type { Account } from "../../application/use-cases/get-account.js";
import type { SystemStatus } from "../../application/use-cases/get-system-status.js";
import type { NearbyResult } from "../../application/use-cases/search-nearby-listings.js";
import type { Listing } from "../../domain/listing.js";

function presentListing(listing: Listing, distanceKm: number | null) {
  const { location } = listing;
  return {
    id: listing.id,
    text: listing.text,
    kind: listing.kind,
    origin: listing.origin,
    price: listing.price ?? null,
    priceSource: listing.priceSource ?? null,
    permalink: listing.permalink,
    author: listing.author,
    postedAt: listing.postedAt?.toISOString(),
    location: location ? { lat: location.point.lat, lng: location.point.lng, place: location.place, source: location.source } : null,
    distanceKm,
  };
}

export function presentListings(result: NearbyResult) {
  return {
    items: result.items.map(({ listing, distanceKm }) => presentListing(listing, distanceKm)),
    unlocated: result.unlocated.map((listing) => presentListing(listing, null)),
    counts: result.counts,
  };
}

export function presentPlace(place: Place) {
  return { lat: place.lat, lng: place.lng, name: place.name };
}

export function presentAccount({ user, threadsConnected, threadsExpiresAt }: Account) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    pictureUrl: user.pictureUrl,
    threadsConnected,
    threadsExpiresAt: threadsExpiresAt?.toISOString(),
  };
}

export function presentSystemStatus(status: SystemStatus) {
  return { ...status, lastRefreshedAt: status.lastRefreshedAt?.toISOString() };
}

export function presentRefreshStatus(status: RefreshStatus) {
  switch (status.state) {
    case "idle":
      return { state: status.state };
    case "running":
      return { state: status.state, startedAt: status.startedAt.toISOString(), ...status.progress };
    case "done":
      return { state: status.state, startedAt: status.startedAt.toISOString(), finishedAt: status.finishedAt.toISOString(), ...status.summary };
    case "error":
      return { state: status.state, startedAt: status.startedAt.toISOString(), finishedAt: status.finishedAt.toISOString(), message: status.message };
  }
}
