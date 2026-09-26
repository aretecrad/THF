import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SEARCH_TERMS } from "../../src/application/search-terms.js";
import { RefreshListings, type RefreshSettings } from "../../src/application/use-cases/refresh-listings.js";
import type { Post } from "../../src/domain/post.js";
import { LoginRequiredError } from "../../src/application/errors.js";
import {
  aComment,
  aCredential,
  aListing,
  aPost,
  at,
  DAY,
  FakeGeocoder,
  FakePostSource,
  FakePostSourceFactory,
  FixedClock,
  InMemoryCredentialStore,
  InMemoryListingRepository,
} from "../support/fakes.js";

const now = new Date("2026-09-24T00:00:00Z");
const settings: RefreshSettings = {
  searchTerms: [{ query: "rumah dijual", mode: "KEYWORD" }],
  maxGeocodesPerRun: 10,
  placesTriedPerListing: 4,
  readComments: true,
  maxCommentFetchesPerRun: 10,
  commentPagesPerPost: 2,
  checkpointEvery: 2,
};
const places = {
  kemang: { lat: -6.2607, lng: 106.8136, name: "Kemang" },
  depok: { lat: -6.4025, lng: 106.7942, name: "Depok" },
  margonda: { lat: -6.37, lng: 106.832, name: "Margonda" },
};

const complete = aPost({ id: "complete", text: "Disewakan rumah di Kemang. 150jt/thn", hasReplies: true });
const tagged = aPost({ id: "tagged", text: "Dijual rumah siap huni, info DM", hasReplies: true, taggedPlace: { point: { lat: -6.3667, lng: 106.8981 }, name: "Cibubur" } });
const sparse = aPost({ id: "sparse", text: "Dijual rumah 2 lantai, SHM. Harga via komen", hasReplies: true });
const wanted = aPost({ id: "wanted", text: "Lagi cari kontrakan di Depok budget 2jt/bln", author: "seeker", hasReplies: true });
const silent = aPost({ id: "silent", text: "Disewakan rumah minimalis, info DM", hasReplies: false });
const posts = [complete, tagged, sparse, wanted, silent];

const comments: Record<string, Post[]> = {
  tagged: [aComment({ id: "t1", text: "Harga 1,25M nego", author: "seller" })],
  sparse: [aComment({ id: "s1", text: "Lokasinya di Depok kak, harga 850jt", author: "seller" })],
  wanted: [aComment({ id: "w1", text: "Ada kak, kontrakan di Margonda 1,8jt/bln", author: "owner" })],
};

const USER = "user-1";
const options = { days: 30, pagesPerSearch: 2 };

function setUp(setup: { existing?: Parameters<typeof aListing>[0][]; settings?: Partial<RefreshSettings>; commentError?: string } = {}) {
  const repository = new InMemoryListingRepository({ [USER]: (setup.existing ?? []).map(aListing) });
  const credentials = new InMemoryCredentialStore();
  void credentials.save(USER, aCredential(new Date(now.getTime() - DAY), "user-1-token"));
  const geocoder = new FakeGeocoder(places);
  const source = new FakePostSource({ posts: { "rumah dijual": posts }, comments, commentError: setup.commentError });
  const sources = new FakePostSourceFactory(source);
  const refresh = new RefreshListings(sources, geocoder, repository, credentials, new FixedClock(now), { ...settings, ...setup.settings });
  const byId = async () => new Map((await repository.findAll(USER)).map((listing) => [listing.id, listing]));
  return { repository, credentials, geocoder, source, sources, refresh, byId };
}

describe("RefreshListings", () => {
  it("stores offers, completes them from their authors' comments, and marks what's still missing", async () => {
    const { refresh, byId } = setUp();
    const summary = await refresh.execute(USER, options);
    const listings = await byId();

    assert.deepEqual([...listings.keys()].sort(), ["complete", "silent", "sparse", "tagged", "w1"]);
    assert.deepEqual(summary, {
      postsFound: 5, added: 5, located: 4, commentsRead: 3,
      geocodeLimitReached: false, commentLimitReached: false, commentsError: undefined,
    });

    assert.equal(listings.get("tagged")?.price, "1,25M");
    assert.equal(listings.get("tagged")?.priceSource, "comment");
    assert.equal(listings.get("tagged")?.location?.source, "tag");

    assert.equal(listings.get("sparse")?.price, "850jt");
    assert.deepEqual(listings.get("sparse")?.location, { point: { lat: -6.4025, lng: 106.7942 }, place: "Depok", source: "comment" });

    assert.equal(listings.get("w1")?.origin, "comment");
    assert.equal(listings.get("w1")?.location?.place, "Margonda");

    assert.equal(listings.get("silent")?.price, undefined, "no price anywhere: shown as N/A");
    assert.equal(listings.get("silent")?.location, undefined, "no place anywhere: shown as N/A");
  });

  it("only reads comments when a detail is missing or someone is looking for a house", async () => {
    const { refresh, source } = setUp();
    await refresh.execute(USER, options);
    assert.deepEqual(source.commentRequests, ["tagged", "sparse", "wanted"]);
  });

  it("can be told not to read comments at all", async () => {
    const { refresh, source, byId } = setUp({ settings: { readComments: false } });
    await refresh.execute(USER, options);
    assert.deepEqual(source.commentRequests, []);
    assert.equal((await byId()).get("sparse")?.price, undefined);
  });

  it("still finishes when comments can't be read, and says why", async () => {
    const { refresh, source } = setUp({ commentError: "Application does not have permission for this action" });
    const summary = await refresh.execute(USER, options);
    assert.equal(summary.commentsError, "Application does not have permission for this action");
    assert.equal(summary.added, 4);
    assert.deepEqual(source.commentRequests, ["tagged"], "stops asking after the first failure");
  });

  it("respects the per-refresh comment limit", async () => {
    const { refresh } = setUp({ settings: { maxCommentFetchesPerRun: 1 } });
    const summary = await refresh.execute(USER, options);
    assert.equal(summary.commentsRead, 1);
    assert.equal(summary.commentLimitReached, true);
  });

  it("revisits listings with missing details, but leaves complete ones alone", async () => {
    const { refresh, source, byId } = setUp({
      existing: [
        { id: "complete", price: "150jt/thn", location: at(-6.26, 106.81, "Kemang") },
        { id: "sparse", location: at(-6.4, 106.79, "Depok") },
      ],
    });
    const summary = await refresh.execute(USER, options);
    assert.ok(source.commentRequests.includes("sparse"));
    assert.equal((await byId()).get("sparse")?.price, "850jt");
    assert.equal(summary.added, 3);
  });

  it("records when the refresh happened", async () => {
    const { refresh, repository } = setUp();
    await refresh.execute(USER, options);
    assert.deepEqual(await repository.lastRefreshedAt(USER), now);
  });

  it("searches recent and top posts from the requested day", async () => {
    const { refresh, source } = setUp();
    await refresh.execute(USER, { days: 7, pagesPerSearch: 3 });
    assert.deepEqual(source.searches.map((s) => s.order), ["RECENT", "TOP"]);
    assert.equal(source.searches[0].since.toISOString(), "2026-09-17T00:00:00.000Z");
  });

  it("stops geocoding at the per-refresh limit and says so", async () => {
    const { refresh } = setUp({ settings: { maxGeocodesPerRun: 1 } });
    const summary = await refresh.execute(USER, options);
    assert.equal(summary.geocodeLimitReached, true);
  });

  it("searches Threads with the user's own token and stores listings for that user only", async () => {
    const { refresh, sources, repository } = setUp();
    await refresh.execute(USER, options);
    assert.deepEqual(sources.tokensUsed, ["user-1-token"]);
    assert.equal((await repository.findAll("someone-else")).length, 0);
  });

  it("asks the user to log in again when their Threads login is missing or expired", async () => {
    const { refresh, credentials } = setUp();
    await assert.rejects(refresh.execute("never-logged-in", options), LoginRequiredError);

    await credentials.save(USER, aCredential(new Date(now.getTime() - 61 * DAY)));
    await assert.rejects(refresh.execute(USER, options), LoginRequiredError);
  });

  it("covers keyword and topic-tag searches by default", () => {
    assert.ok(DEFAULT_SEARCH_TERMS.some((term) => term.mode === "KEYWORD"));
    assert.ok(DEFAULT_SEARCH_TERMS.some((term) => term.mode === "TAG"));
  });
});
