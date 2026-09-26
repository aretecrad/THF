import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CheckDeletion, DeleteUserData, DisconnectThreads } from "../../src/application/use-cases/delete-user-data.js";
import { GetAccount } from "../../src/application/use-cases/get-account.js";
import { RenewAccessTokens } from "../../src/application/use-cases/renew-access-tokens.js";
import { ThreadsLogin } from "../../src/application/use-cases/threads-login.js";
import {
  aCredential,
  aListing,
  DAY,
  FakeAuthProvider,
  FixedClock,
  InMemoryCredentialStore,
  InMemoryDeletionLog,
  InMemoryListingRepository,
  InMemoryUserRepository,
} from "../support/fakes.js";

function setUp() {
  const clock = new FixedClock(new Date("2026-09-24T00:00:00Z"));
  const users = new InMemoryUserRepository();
  const credentials = new InMemoryCredentialStore();
  const listings = new InMemoryListingRepository();
  const deletions = new InMemoryDeletionLog();
  const auth = new FakeAuthProvider(clock);
  return {
    clock, users, credentials, listings, deletions, auth,
    login: new ThreadsLogin(auth, users, credentials, clock),
    getAccount: new GetAccount(users, credentials, clock),
    deleteUserData: new DeleteUserData(users, credentials, listings, deletions, clock),
  };
}

describe("ThreadsLogin", () => {
  it("creates the user from their Threads profile and keeps their 60-day token", async () => {
    const { login, getAccount } = setUp();
    const user = await login.complete("good-code");
    assert.deepEqual({ id: user.id, username: user.username }, { id: "1784140579318721", username: "josua" });

    const account = await getAccount.execute(user.id);
    assert.equal(account?.threadsConnected, true);
    assert.equal(account?.threadsExpiresAt?.toISOString(), "2026-11-23T00:00:00.000Z");
  });

  it("keeps the original sign-up date when the user logs in again", async () => {
    const { login, clock } = setUp();
    const first = await login.complete("good-code");
    clock.advance(10 * DAY);
    const again = await login.complete("good-code");
    assert.deepEqual(again.createdAt, first.createdAt);
  });

  it("fails without creating anyone when the code is wrong", async () => {
    const { login, users } = setUp();
    await assert.rejects(login.complete("used-code"));
    assert.equal(users.users.size, 0);
  });
});

describe("GetAccount", () => {
  it("reports an expired Threads login as disconnected", async () => {
    const { login, getAccount, clock } = setUp();
    const user = await login.complete("good-code");
    clock.advance(61 * DAY);
    assert.equal((await getAccount.execute(user.id))?.threadsConnected, false);
  });

  it("returns nothing for unknown users", async () => {
    assert.equal(await setUp().getAccount.execute("nobody"), undefined);
  });
});

describe("RenewAccessTokens", () => {
  it("renews tokens that are a week old, leaves newer ones, and reports failures", async () => {
    const { auth, credentials, clock } = setUp();
    const now = clock.now();
    await credentials.save("fresh", aCredential(new Date(now.getTime() - 2 * DAY), "fresh-token"));
    await credentials.save("due", aCredential(new Date(now.getTime() - 8 * DAY), "due-token"));
    await credentials.save("revoked", aCredential(new Date(now.getTime() - 9 * DAY), "revoked-token"));
    auth.failRenewalFor.add("revoked-token");

    const summary = await new RenewAccessTokens(auth, credentials, clock).execute();
    assert.equal(summary.renewed, 1);
    assert.deepEqual(summary.failed.map((f) => f.userId), ["revoked"]);
    assert.equal((await credentials.find("due"))?.accessToken, "due-token+renewed");
    assert.equal((await credentials.find("fresh"))?.accessToken, "fresh-token");
  });
});

describe("Deleting and disconnecting", () => {
  it("deletes the user, their token and their listings, and returns a confirmation code", async () => {
    const { login, listings, credentials, deletions, deleteUserData, getAccount } = setUp();
    const user = await login.complete("good-code");
    await listings.saveAll(user.id, [aListing({ id: "l1" })]);

    const record = await deleteUserData.execute(user.id);
    assert.equal(await getAccount.execute(user.id), undefined);
    assert.equal(await credentials.find(user.id), undefined);
    assert.equal(listings.hasOwner(user.id), false);
    assert.deepEqual(await new CheckDeletion(deletions).execute(record.confirmationCode), record);
  });

  it("forgets only the token when the user removes the app in Threads", async () => {
    const { login, listings, credentials, getAccount } = setUp();
    const user = await login.complete("good-code");
    await listings.saveAll(user.id, [aListing({ id: "l1" })]);

    await new DisconnectThreads(credentials).execute(user.id);
    assert.equal((await getAccount.execute(user.id))?.threadsConnected, false);
    assert.equal((await listings.findAll(user.id)).length, 1);
  });
});
