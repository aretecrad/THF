import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SearchNearbyListings } from "../../src/application/use-cases/search-nearby-listings.js";
import { aListing, at, FixedClock, InMemoryListingRepository } from "../support/fakes.js";

const now = new Date("2026-09-24T00:00:00Z");
const kuningan = { lat: -6.2297, lng: 106.8295 };
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

const listings = [
  aListing({ id: "setiabudi", kind: "rent", location: at(-6.218, 106.83), postedAt: daysAgo(3) }),
  aListing({ id: "tebet", kind: "sale", location: at(-6.2261, 106.855), postedAt: daysAgo(2) }),
  aListing({ id: "gading", kind: "sale/rent", location: at(-6.158, 106.905), postedAt: daysAgo(1) }),
  aListing({ id: "bsd", kind: "sale", location: at(-6.301, 106.652), postedAt: daysAgo(4) }),
  aListing({ id: "old", kind: "sale", location: at(-6.23, 106.83), postedAt: daysAgo(60) }),
  aListing({ id: "unplaced", kind: "sale", postedAt: daysAgo(1) }),
];

const USER = "user-1";
const search = () => new SearchNearbyListings(new InMemoryListingRepository({ [USER]: listings }), new FixedClock(now));
const execute = (query: Parameters<SearchNearbyListings["execute"]>[1]) => search().execute(USER, query);
const ids = (result: Awaited<ReturnType<typeof execute>>) => result.items.map((item) => item.listing.id);

describe("SearchNearbyListings", () => {
  it("ranks listings inside the radius, nearest first", async () => {
    const result = await execute({ center: kuningan, radiusKm: 15, kind: "all", days: 30, limit: 50 });
    assert.deepEqual(ids(result), ["setiabudi", "tebet", "gading"]);
    assert.deepEqual(result.items.map((item) => item.distanceKm), [1.3, 2.8, 11.5]);
    assert.deepEqual(result.counts, { matching: 5, located: 4, withinRadius: 3 });
  });

  it("includes listings offered for both sale and rent in either filter", async () => {
    const rent = await execute({ center: kuningan, radiusKm: 15, kind: "rent", days: 30, limit: 50 });
    assert.deepEqual(ids(rent), ["setiabudi", "gading"]);
  });

  it("leaves out posts older than the time range", async () => {
    const result = await execute({ center: kuningan, radiusKm: 50, kind: "all", days: 90, limit: 50 });
    assert.ok(ids(result).includes("old"));
  });

  it("lists matching listings without a location separately, newest first", async () => {
    const unplacedRent = aListing({ id: "unplaced-rent", kind: "rent", postedAt: daysAgo(2) });
    const repository = new InMemoryListingRepository({ [USER]: [...listings, unplacedRent] });
    const result = await new SearchNearbyListings(repository, new FixedClock(now)).execute(USER, { center: kuningan, radiusKm: 15, kind: "all", days: 30, limit: 50 });
    assert.deepEqual(result.unlocated.map((l) => l.id), ["unplaced", "unplaced-rent"]);

    const rentOnly = await new SearchNearbyListings(repository, new FixedClock(now)).execute(USER, { center: kuningan, radiusKm: 15, kind: "rent", days: 30, limit: 50 });
    assert.deepEqual(rentOnly.unlocated.map((l) => l.id), ["unplaced-rent"]);
  });

  it("only ever returns the user's own listings", async () => {
    const result = await search().execute("someone-else", { center: kuningan, radiusKm: 50, kind: "all", days: 30, limit: 50 });
    assert.equal(result.items.length + result.unlocated.length, 0);
  });

  it("returns every located listing, newest first, when no end point is given", async () => {
    const result = await execute({ radiusKm: 10, kind: "all", days: 30, limit: 50 });
    assert.deepEqual(ids(result), ["gading", "tebet", "setiabudi", "bsd"]);
    assert.equal(result.counts.withinRadius, null);
  });
});
