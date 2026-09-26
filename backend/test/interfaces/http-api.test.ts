import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { LightMyRequestResponse } from "fastify";
import { RefreshJob } from "../../src/application/refresh-job.js";
import { CheckDeletion, DeleteUserData, DisconnectThreads } from "../../src/application/use-cases/delete-user-data.js";
import { GetAccount } from "../../src/application/use-cases/get-account.js";
import { GetSystemStatus } from "../../src/application/use-cases/get-system-status.js";
import { RefreshListings } from "../../src/application/use-cases/refresh-listings.js";
import { ResolvePlace } from "../../src/application/use-cases/resolve-place.js";
import { SearchNearbyListings } from "../../src/application/use-cases/search-nearby-listings.js";
import { ThreadsLogin } from "../../src/application/use-cases/threads-login.js";
import { MetaSignedRequestVerifier } from "../../src/infrastructure/security/meta-signed-request.js";
import { SqliteSessionStore } from "../../src/infrastructure/persistence/sqlite-session-store.js";
import { buildHttpServer } from "../../src/interfaces/http/server.js";
import {
  aListing,
  at,
  FakeAuthProvider,
  FakeGeocoder,
  FakePostSourceFactory,
  FixedClock,
  InMemoryCredentialStore,
  InMemoryDeletionLog,
  InMemoryListingRepository,
  InMemoryUserRepository,
  memoryDatabase,
} from "../support/fakes.js";
import { signedRequest } from "../support/signed-request.js";

const APP_URL = "https://houses.example";
const APP_SECRET = "app-secret";
const JOSUA = "1784140579318721";

const clock = new FixedClock(new Date("2026-09-24T00:00:00Z"));
const users = new InMemoryUserRepository();
const credentials = new InMemoryCredentialStore();
const listings = new InMemoryListingRepository({
  [JOSUA]: [
    aListing({ id: "tebet", price: "Rp 3,8 M", priceSource: "comment", location: at(-6.2261, 106.855, "Tebet"), postedAt: new Date("2026-09-20T00:00:00Z") }),
    aListing({ id: "somewhere", postedAt: new Date("2026-09-21T00:00:00Z") }),
  ],
});
const deletions = new InMemoryDeletionLog();
const geocoder = new FakeGeocoder({ kemang: { lat: -6.2607, lng: 106.8136, name: "Kemang, Jakarta Selatan" } });
const refreshSettings = { searchTerms: [], maxGeocodesPerRun: 1, placesTriedPerListing: 1, readComments: false, maxCommentFetchesPerRun: 0, commentPagesPerPost: 1, checkpointEvery: 1 };
const refreshJob = new RefreshJob(new RefreshListings(new FakePostSourceFactory(), geocoder, listings, credentials, clock, refreshSettings), clock);

const app = await buildHttpServer(
  {
    threadsLogin: new ThreadsLogin(new FakeAuthProvider(clock), users, credentials, clock),
    getAccount: new GetAccount(users, credentials, clock),
    deleteUserData: new DeleteUserData(users, credentials, listings, deletions, clock),
    disconnect: new DisconnectThreads(credentials),
    checkDeletion: new CheckDeletion(deletions),
    searchNearby: new SearchNearbyListings(listings, clock),
    resolvePlace: new ResolvePlace(geocoder),
    refreshJob,
    getSystemStatus: new GetSystemStatus(listings, credentials, clock),
  },
  {
    appUrl: APP_URL,
    corsOrigin: APP_URL,
    sessionSecret: "a-test-session-secret-that-is-long-enough",
    secureCookies: true,
    signedRequests: new MetaSignedRequestVerifier(APP_SECRET),
    logger: false,
    trustProxy: false,
    sessionStore: new SqliteSessionStore(memoryDatabase()),
  },
);
after(() => app.close());

const cookieFrom = (response: LightMyRequestResponse, name: string) => response.cookies.find((cookie) => cookie.name === name);
const withSession = (session: string) => ({ cookie: `thf_session=${session}` });

async function logInWithThreads(code = "good-code"): Promise<string> {
  const start = await app.inject("/api/auth/threads/login");
  const state = new URL(start.headers.location as string).searchParams.get("state")!;
  const stateCookie = cookieFrom(start, "thf_login_state")!.value;
  const callback = await app.inject({
    url: `/api/auth/threads/callback?code=${code}&state=${state}`,
    headers: { cookie: `thf_login_state=${stateCookie}` },
  });
  assert.equal(callback.headers.location, `${APP_URL}/`);
  return cookieFrom(callback, "thf_session")!.value;
}

describe("Logging in", () => {
  it("keeps every data route behind a login", async () => {
    for (const url of ["/api/me", "/api/status", "/api/listings", "/api/places?q=Kemang", "/api/refresh"]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 401, url);
      assert.deepEqual(response.json(), { error: "Log in to continue.", code: "not_signed_in" });
    }
  });

  it("sends the user to Threads with a one-time state stored in a secure, http-only cookie", async () => {
    const response = await app.inject("/api/auth/threads/login");
    assert.equal(response.statusCode, 302);
    const state = new URL(response.headers.location as string).searchParams.get("state");
    const cookie = cookieFrom(response, "thf_login_state");
    assert.ok(state && state.length >= 20);
    assert.equal(cookie?.httpOnly, true);
    assert.equal(cookie?.secure, true);
    assert.equal(cookie?.sameSite, "Lax");
  });

  it("logs the user in when Threads sends them back with a valid code", async () => {
    const session = await logInWithThreads();
    const me = (await app.inject({ url: "/api/me", headers: withSession(session) })).json();
    assert.deepEqual({ username: me.username, threadsConnected: me.threadsConnected }, { username: "josua", threadsConnected: true });
  });

  it("rejects callbacks that don't match a login this browser started", async () => {
    const forged = await app.inject("/api/auth/threads/callback?code=good-code&state=guessed");
    assert.equal(forged.headers.location, `${APP_URL}/?login_error=expired`);
    assert.equal(cookieFrom(forged, "thf_session")?.value ?? "", "");
  });

  it("explains when the user cancels or the code is bad", async () => {
    const cancelled = await app.inject("/api/auth/threads/callback?error=access_denied&error_reason=user_denied");
    assert.equal(cancelled.headers.location, `${APP_URL}/?login_error=denied`);

    const start = await app.inject("/api/auth/threads/login");
    const state = new URL(start.headers.location as string).searchParams.get("state")!;
    const bad = await app.inject({
      url: `/api/auth/threads/callback?code=used-code&state=${state}`,
      headers: { cookie: `thf_login_state=${cookieFrom(start, "thf_login_state")!.value}` },
    });
    assert.equal(bad.headers.location, `${APP_URL}/?login_error=failed`);
  });

  it("ignores session cookies that were tampered with", async () => {
    const response = await app.inject({ url: "/api/me", headers: withSession(`${JOSUA}.forged-signature`) });
    assert.equal(response.statusCode, 401);
  });

  it("logs out, and the old session cookie stops working", async () => {
    const session = await logInWithThreads();
    const response = await app.inject({ method: "POST", url: "/api/auth/logout", headers: withSession(session) });
    assert.equal(response.statusCode, 204);
    assert.equal(cookieFrom(response, "thf_session")?.value, "");
    assert.equal((await app.inject({ url: "/api/me", headers: withSession(session) })).statusCode, 401);
  });

  it("gives each login its own session", async () => {
    assert.notEqual(await logInWithThreads(), await logInWithThreads());
  });
});

describe("Listings API", () => {
  it("returns the user's ranked listings, with missing details as null", async () => {
    const session = await logInWithThreads();
    const body = (await app.inject({ url: "/api/listings?lat=-6.2297&lng=106.8295&radiusKm=5", headers: withSession(session) })).json();
    assert.equal(body.items[0].id, "tebet");
    assert.equal(body.items[0].distanceKm, 2.8);
    assert.equal(body.items[0].priceSource, "comment");
    assert.deepEqual(body.unlocated.map((l: { id: string; price: null; location: null }) => [l.id, l.price, l.location]), [["somewhere", null, null]]);
  });

  it("answers bad input with 400 and a readable message", async () => {
    const session = await logInWithThreads();
    const badKind = await app.inject({ url: "/api/listings?kind=buy", headers: withSession(session) });
    assert.equal(badKind.statusCode, 400);
    const halfPoint = await app.inject({ url: "/api/listings?lat=-6.2", headers: withSession(session) });
    assert.equal(halfPoint.json().error, "Send both lat and lng, or neither.");
  });

});

describe("Meta callbacks", () => {
  const form = (signed: string) => ({ headers: { "content-type": "application/x-www-form-urlencoded" }, payload: `signed_request=${encodeURIComponent(signed)}` });

  it("deletes everything on a data-deletion request and gives Meta a status link", async () => {
    const session = await logInWithThreads();
    const response = await app.inject({ method: "POST", url: "/api/threads/data-deletion", ...form(signedRequest({ algorithm: "HMAC-SHA256", user_id: JOSUA }, APP_SECRET)) });
    const { url, confirmation_code: code } = response.json();
    assert.match(code, /^[A-Z0-9]+$/);
    assert.equal(url, `${APP_URL}/api/threads/data-deletion/status?code=${code}`);

    const status = await app.inject(`/api/threads/data-deletion/status?code=${code}`);
    assert.match(status.body, /was deleted/);
    assert.equal((await app.inject({ url: "/api/me", headers: withSession(session) })).statusCode, 401);
    assert.equal(listings.hasOwner(JOSUA), false);

    await logInWithThreads();
    assert.equal((await app.inject({ url: "/api/me", headers: withSession(session) })).statusCode, 401);
  });

  it("forgets the Threads token when the user removes the app", async () => {
    const session = await logInWithThreads();
    await app.inject({ method: "POST", url: "/api/threads/deauthorize", ...form(signedRequest({ algorithm: "HMAC-SHA256", user_id: JOSUA }, APP_SECRET)) });
    const me = (await app.inject({ url: "/api/me", headers: withSession(session) })).json();
    assert.equal(me.threadsConnected, false);
  });

  it("rejects callbacks that weren't signed with the app secret", async () => {
    const response = await app.inject({ method: "POST", url: "/api/threads/data-deletion", ...form(signedRequest({ algorithm: "HMAC-SHA256", user_id: JOSUA }, "wrong")) });
    assert.equal(response.statusCode, 400);
  });
});

describe("Running in production", () => {
  it("refuses writes sent from other sites", async () => {
    const session = await logInWithThreads();
    const refresh = (origin: string) => app.inject({ method: "POST", url: "/api/refresh", headers: { ...withSession(session), origin }, payload: {} });
    const forged = await refresh("https://evil.example");
    assert.equal(forged.statusCode, 403);
    assert.notEqual((await refresh(APP_URL)).statusCode, 403);
  });

  it("answers health checks without a login", async () => {
    const response = await app.inject("/api/health");
    assert.deepEqual([response.statusCode, response.json()], [200, { ok: true }]);
  });

  it("sends security headers on every response", async () => {
    const response = await app.inject("/api/me");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.match(String(response.headers["strict-transport-security"]), /max-age=/);
  });

  it("limits place lookups per session, not per shared IP", async () => {
    const [mine, theirs] = [await logInWithThreads(), await logInWithThreads()];
    const lookup = (session: string) => app.inject({ url: "/api/places?q=Kemang", headers: withSession(session), remoteAddress: "10.0.0.9" });
    for (let i = 0; i < 20; i++) assert.equal((await lookup(mine)).statusCode, 200);

    const limited = await lookup(mine);
    assert.equal(limited.statusCode, 429);
    assert.ok(Number(limited.headers["retry-after"]) > 0);
    assert.equal((await lookup(theirs)).statusCode, 200);
  });
});
