import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { PruneOldListings } from "../../src/application/use-cases/prune-old-listings.js";
import { openDatabase } from "../../src/infrastructure/persistence/database.js";
import { SqliteDeletionLog } from "../../src/infrastructure/persistence/sqlite-deletion-log.js";
import { SqliteListingRepository } from "../../src/infrastructure/persistence/sqlite-listing-repository.js";
import { SqliteSessionStore } from "../../src/infrastructure/persistence/sqlite-session-store.js";
import { SqliteUserRepository } from "../../src/infrastructure/persistence/sqlite-user-repository.js";
import { aListing, at, DAY, FixedClock, InMemoryListingRepository } from "../support/fakes.js";

const folder = mkdtempSync(join(tmpdir(), "thf-"));
after(() => rmSync(folder, { recursive: true, force: true }));

describe("SQLite storage", () => {
  it("keeps users, listings, sessions and deletions across a restart", async () => {
    const path = join(folder, "data", "thf.db");
    const createdAt = new Date("2026-09-01T00:00:00Z");
    const listing = aListing({ id: "tebet", price: "Rp 3,8 M", location: at(-6.2261, 106.855, "Tebet"), postedAt: new Date("2026-09-20T00:00:00Z") });

    const first = openDatabase(path);
    await new SqliteUserRepository(first).save({ id: "u1", username: "josua", createdAt });
    await new SqliteListingRepository(first).saveAll("u1", [listing]);
    await new SqliteSessionStore(first).save("hash", { userId: "u1", expiresAt: new Date("2026-10-01T00:00:00Z") });
    const { confirmationCode } = await new SqliteDeletionLog(first).record(createdAt);
    first.close();

    const second = openDatabase(path);
    assert.deepEqual(await new SqliteUserRepository(second).findById("u1"), { id: "u1", username: "josua", createdAt });
    assert.deepEqual(await new SqliteListingRepository(second).findAll("u1"), [listing]);
    assert.equal((await new SqliteSessionStore(second).find("hash"))?.userId, "u1");
    assert.equal((await new SqliteDeletionLog(second).find(confirmationCode.toLowerCase()))?.confirmationCode, confirmationCode);
    second.close();
  });

  it("updates a listing in place instead of duplicating it", async () => {
    const repository = new InMemoryListingRepository();
    await repository.saveAll("u1", [aListing({ id: "a" }), aListing({ id: "b" })]);
    await repository.saveAll("u1", [aListing({ id: "a", price: "Rp 1 M" })]);
    assert.deepEqual((await repository.findAll("u1")).map((l) => [l.id, l.price]), [["a", "Rp 1 M"], ["b", undefined]]);
  });

  it("ends every session of a user, and expired ones", async () => {
    const store = new SqliteSessionStore(openDatabase(":memory:"));
    await store.save("a", { userId: "u1", expiresAt: new Date("2026-10-01T00:00:00Z") });
    await store.save("b", { userId: "u1", expiresAt: new Date("2026-10-01T00:00:00Z") });
    await store.save("c", { userId: "u2", expiresAt: new Date("2026-09-01T00:00:00Z") });

    await store.deleteForUser("u1");
    await store.deleteExpired(new Date("2026-09-15T00:00:00Z"));
    assert.deepEqual([await store.find("a"), await store.find("b"), await store.find("c")], [undefined, undefined, undefined]);
  });
});

describe("PruneOldListings", () => {
  it("deletes listings older than the retention period, by post date or else fetch date", async () => {
    const now = new Date("2026-09-24T00:00:00Z");
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
    const repository = new InMemoryListingRepository({
      u1: [
        aListing({ id: "old", postedAt: daysAgo(100), fetchedAt: daysAgo(1) }),
        aListing({ id: "recent", postedAt: daysAgo(10), fetchedAt: daysAgo(1) }),
        aListing({ id: "undated-old", fetchedAt: daysAgo(100) }),
        aListing({ id: "undated-recent", fetchedAt: daysAgo(1) }),
      ],
    });

    assert.equal(await new PruneOldListings(repository, new FixedClock(now), 90).execute(), 2);
    assert.deepEqual((await repository.findAll("u1")).map((l) => l.id), ["recent", "undated-recent"]);
  });
});
