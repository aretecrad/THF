import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LoginRequiredError } from "../../src/application/errors.js";
import { RefreshJob } from "../../src/application/refresh-job.js";
import { RefreshListings } from "../../src/application/use-cases/refresh-listings.js";
import {
  aCredential,
  aPost,
  FakeGeocoder,
  FakePostSource,
  FakePostSourceFactory,
  FixedClock,
  InMemoryCredentialStore,
  InMemoryListingRepository,
} from "../support/fakes.js";

const clock = new FixedClock(new Date("2026-09-24T00:00:00Z"));
const settings = {
  searchTerms: [{ query: "rumah dijual", mode: "KEYWORD" as const }],
  maxGeocodesPerRun: 10,
  placesTriedPerListing: 3,
  readComments: true,
  maxCommentFetchesPerRun: 10,
  commentPagesPerPost: 1,
  checkpointEvery: 25,
};
const options = { days: 30, pagesPerSearch: 1 };

function jobWith(source: FakePostSource, loggedIn: readonly string[] = ["alice", "bob"], onUnexpectedError?: (error: unknown) => void) {
  const credentials = new InMemoryCredentialStore();
  for (const userId of loggedIn) void credentials.save(userId, aCredential(clock.now()));
  const refresh = new RefreshListings(new FakePostSourceFactory(source), new FakeGeocoder({}), new InMemoryListingRepository(), credentials, clock, settings);
  return new RefreshJob(refresh, clock, onUnexpectedError);
}

describe("RefreshJob", () => {
  it("runs in the background and reports the result", async () => {
    const job = jobWith(new FakePostSource({ posts: { "rumah dijual": [aPost({ id: "p1", text: "Dijual rumah, 900jt" })] } }));
    assert.equal((await job.start("alice", options)).state, "running");
    await job.settled("alice");

    const status = job.current("alice");
    assert.equal(status.state, "done");
    assert.equal(status.state === "done" && status.summary.added, 1);
  });

  it("runs one refresh per user, and keeps users' statuses apart", async () => {
    const job = jobWith(new FakePostSource());
    const first = await job.start("alice", options);
    assert.equal(await job.start("alice", options), first);
    assert.equal(job.current("bob").state, "idle");
  });

  it("starts only one run when two requests arrive together", async () => {
    const source = new FakePostSource();
    const job = jobWith(source);
    const [first, second] = await Promise.all([job.start("alice", options), job.start("alice", options)]);
    assert.equal(second, first);
    await job.settled("alice");
    assert.equal(source.searches.length, 2);
  });

  it("lets no refresh start while the user's data is being deleted", async () => {
    const job = jobWith(new FakePostSource());
    let startedDuringDeletion: Promise<unknown> | undefined;
    await job.whileStopped("alice", async () => {
      startedDuringDeletion = job.start("alice", options);
    });
    await assert.rejects(startedDuringDeletion!, LoginRequiredError);
    assert.equal(job.current("alice").state, "idle");
  });

  it("cancels a running refresh when the user's data is deleted", async () => {
    const source = new FakePostSource();
    const job = jobWith(source);
    await job.start("alice", options);
    await job.whileStopped("alice", async () => {});
    assert.equal(source.searches.length, 0);
  });

  it("goes back to its previous status when a refresh can't start", async () => {
    const job = jobWith(new FakePostSource(), []);
    await assert.rejects(job.start("alice", options), LoginRequiredError);
    assert.equal(job.current("alice").state, "idle");
  });

  it("refuses to start for a user without a Threads login", async () => {
    await assert.rejects(jobWith(new FakePostSource(), []).start("alice", options), LoginRequiredError);
  });

  it("reports failures instead of throwing", async () => {
    const job = jobWith(new FakePostSource({ searchError: "quota exceeded" }));
    await job.start("alice", options);
    await job.settled("alice");
    const status = job.current("alice");
    assert.deepEqual({ state: status.state, message: status.state === "error" ? status.message : undefined }, { state: "error", message: "quota exceeded" });
  });

  it("hides unexpected errors from the user and reports them", async () => {
    class CrashingSource extends FakePostSource {
      override async search(): Promise<never> {
        throw new TypeError("Cannot read properties of undefined (reading 'data')");
      }
    }
    const reported: unknown[] = [];
    const job = jobWith(new CrashingSource(), ["alice"], (error) => reported.push(error));
    await job.start("alice", options);
    await job.settled("alice");

    const status = job.current("alice");
    assert.equal(status.state, "error");
    assert.doesNotMatch(status.state === "error" ? status.message : "", /undefined/);
    assert.equal(reported.length, 1);
  });
});
