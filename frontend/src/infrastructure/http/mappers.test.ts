import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ListingDto } from "./dto";
import { toListingsPage } from "./mappers";

const dto = (overrides: Partial<ListingDto>): ListingDto => ({
  id: "x",
  text: "Dijual rumah",
  kind: "sale",
  origin: "post",
  price: null,
  priceSource: null,
  location: null,
  distanceKm: null,
  ...overrides,
});

describe("toListingsPage", () => {
  it("turns missing details (null) into undefined, which the UI shows as N/A", () => {
    const page = toListingsPage({
      items: [],
      unlocated: [dto({ id: "somewhere", origin: "comment" })],
      counts: { matching: 1, located: 0, withinRadius: 0 },
    });
    const [listing] = page.unlocated;
    assert.equal(listing.price, undefined);
    assert.equal(listing.location, undefined);
    assert.equal(listing.origin, "comment");
  });

  it("keeps where each detail came from", () => {
    const page = toListingsPage({
      items: [dto({ price: "850jt", priceSource: "comment", location: { lat: -6.4, lng: 106.8, place: "Depok", source: "comment" }, distanceKm: 19.6 })],
      unlocated: [],
      counts: { matching: 1, located: 1, withinRadius: 1 },
    });
    const [{ listing, distanceKm }] = page.items;
    assert.equal(distanceKm, 19.6);
    assert.equal(listing.priceSource, "comment");
    assert.deepEqual(listing.location, { point: { lat: -6.4, lng: 106.8 }, place: "Depok", source: "comment" });
  });

  it("never ranks an item that has no location", () => {
    const page = toListingsPage({ items: [dto({ distanceKm: 2 })], unlocated: [], counts: { matching: 1, located: 0, withinRadius: 0 } });
    assert.deepEqual(page.items, []);
  });
});
