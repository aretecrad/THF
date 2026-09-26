import { BackendUnavailableError, LocationUnavailableError, RequestRejectedError, type LocationFailure } from "@/application/errors";
import type { Account, LoginError } from "@/domain/account";
import type { KindFilter, Listing, ListingKind, ListingLocation } from "@/domain/listing";
import type { RefreshStatus } from "@/domain/refresh";
import type { SystemStatus } from "@/domain/system";
import { pluralize, timeAgo } from "./format";

export const KIND_LABEL: Readonly<Record<ListingKind, string>> = {
  sale: "Dijual",
  rent: "Disewakan",
  "sale/rent": "Dijual / disewakan",
};

export const KIND_FILTER_LABEL: Readonly<Record<KindFilter, string>> = { all: "All", sale: "Dijual", rent: "Disewakan" };

export const NOT_AVAILABLE = "N/A";

const LOCATION_SOURCE_LABEL: Readonly<Record<ListingLocation["source"], string>> = {
  tag: "Tagged location",
  text: "Location from the listing",
  comment: "Location from a comment",
};

export const priceLabel = (listing: Listing): string => listing.price ?? `Price ${NOT_AVAILABLE}`;

export function placeLabel(listing: Listing): string {
  if (!listing.location) return `Location ${NOT_AVAILABLE}`;
  return listing.location.place ?? LOCATION_SOURCE_LABEL.tag;
}

export function detailNotes(listing: Listing): string[] {
  const notes: string[] = [];
  if (listing.origin === "comment") notes.push("Offered in a comment");
  if (listing.priceSource === "comment") notes.push("Price from a comment");
  if (listing.location) notes.push(LOCATION_SOURCE_LABEL[listing.location.source]);
  return notes;
}

const LOCATION_FAILURE: Readonly<Record<LocationFailure, string>> = {
  unsupported: "This browser can't share your location. Type an address instead.",
  denied: "Location access is blocked for this site. Allow it in the browser, or type an address.",
  failed: "Couldn't get your location. Type an address instead.",
};

export function describeError(error: unknown): string {
  if (error instanceof BackendUnavailableError) return "Can't reach the backend. Start it with npm run dev in the backend folder.";
  if (error instanceof LocationUnavailableError) return LOCATION_FAILURE[error.reason];
  if (error instanceof RequestRejectedError) return error.message;
  return "Something went wrong. Try again.";
}

export function refreshHeadline(status: RefreshStatus, system: SystemStatus | null): string {
  switch (status.state) {
    case "running":
      return status.phase === "searching"
        ? `Searching Threads: ${status.done} of ${status.total} searches`
        : `Reading posts and comments: ${status.done} of ${status.total}`;
    case "error":
      return `Refresh failed: ${status.message}`;
    case "done":
      return `Listings updated ${timeAgo(status.finishedAt)}, ${status.added} new`;
    case "idle":
      return system?.lastRefreshedAt ? `Listings updated ${timeAgo(system.lastRefreshedAt)}` : "Listings not refreshed yet";
  }
}

export function refreshNote(status: RefreshStatus): string | null {
  if (status.state !== "done") return null;
  if (status.postsFound === 0) {
    return "Threads returned no posts. Until Meta approves your app for keyword search, it only searches your own posts.";
  }
  if (status.commentsError) {
    return `Couldn't read comments (${status.commentsError}). Check that your token has the threads_read_replies permission.`;
  }
  if (status.geocodeLimitReached) return "Reached the location lookup limit for one refresh. Refresh again to place the rest.";
  if (status.commentLimitReached) return "Reached the comment limit for one refresh. Refresh again to check more posts.";
  return null;
}

export function unlocatedHint(count: number): string {
  return count === 1
    ? `1 more listing has no location. It's at the end, marked ${NOT_AVAILABLE}.`
    : `${count} more listings have no location. They're at the end, marked ${NOT_AVAILABLE}.`;
}

export function unlocatedNote(count: number): string {
  const subject = count === 1 ? "This listing doesn't" : "These listings don't";
  return `${subject} name a place in the post or the seller's comments, so ${count === 1 ? "it can't" : "they can't"} be ranked by distance.`;
}

export const withinRadiusHeadline = (count: number, radiusKm: number): string =>
  `${pluralize(count, "listing", "listings")} within ${radiusKm} km`;

export const LOGIN_ERROR: Readonly<Record<LoginError, string>> = {
  unavailable: "Log in with Threads isn't set up on this server yet.",
  denied: "You cancelled the Threads login, so nothing was shared.",
  expired: "That login attempt expired or was already used. Try again.",
  failed: "Threads didn't complete the login. Try again in a moment.",
};

export function refreshBlocker(account: Account | null): { readonly message: string; readonly action: string } | null {
  if (!account) return { message: "Log in with Threads to search for listings.", action: "Log in" };
  if (!account.threadsConnected) return { message: "Your Threads login has expired. Log in again to refresh listings.", action: "Log in again" };
  return null;
}

export function accountStatus(account: Account): string {
  return account.threadsConnected ? "Threads connected" : "Threads login expired";
}

export const DELETE_DATA_CONFIRMATION =
  "Delete your account, saved listings and Threads access from this app? This can't be undone.";

export const dataDeletedNotice = (confirmationCode: string): string =>
  `Your data was deleted. Confirmation code: ${confirmationCode}.`;
