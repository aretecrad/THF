import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { loadConfig } from "../../src/infrastructure/config.js";
import { SqliteCredentialStore } from "../../src/infrastructure/persistence/sqlite-credential-store.js";
import { MetaSignedRequestVerifier } from "../../src/infrastructure/security/meta-signed-request.js";
import { TokenCipher } from "../../src/infrastructure/security/token-cipher.js";
import { ThreadsPostSource } from "../../src/infrastructure/threads/threads-post-source.js";
import { aCredential, memoryDatabase } from "../support/fakes.js";
import { signedRequest } from "../support/signed-request.js";

const key = () => randomBytes(32).toString("base64");

describe("TokenCipher", () => {
  it("round-trips a token and never repeats ciphertext", () => {
    const cipher = new TokenCipher(key());
    const a = cipher.encrypt("THQVJ-secret");
    assert.notEqual(a, cipher.encrypt("THQVJ-secret"));
    assert.equal(cipher.decrypt(a), "THQVJ-secret");
  });

  it("rejects tampering and the wrong key", () => {
    const cipher = new TokenCipher(key());
    const sealed = cipher.encrypt("THQVJ-secret");
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    assert.throws(() => cipher.decrypt(tampered));
    assert.throws(() => new TokenCipher(key()).decrypt(sealed));
  });

  it("refuses keys that aren't 32 bytes", () => {
    assert.throws(() => new TokenCipher("too-short"), /32 random bytes/);
  });
});

describe("SqliteCredentialStore", () => {
  it("never stores the token in plain text, and treats unreadable tokens as logged out", async () => {
    const db = memoryDatabase();
    const store = new SqliteCredentialStore(db, new TokenCipher(key()));
    await store.save("u1", aCredential(new Date("2026-09-24T00:00:00Z"), "THQVJ-very-secret"));

    assert.equal((await store.find("u1"))?.accessToken, "THQVJ-very-secret");
    assert.doesNotMatch(JSON.stringify(db.prepare("SELECT * FROM credentials").all()), /THQVJ-very-secret/);

    const withOtherKey = new SqliteCredentialStore(db, new TokenCipher(key()));
    assert.equal(await withOtherKey.find("u1"), undefined);
    assert.deepEqual(await withOtherKey.all(), []);
  });
});

describe("MetaSignedRequestVerifier", () => {
  const verifier = new MetaSignedRequestVerifier("app-secret");

  it("returns the user ID from a correctly signed request", () => {
    assert.equal(verifier.userIdFrom(signedRequest({ algorithm: "HMAC-SHA256", user_id: "218471" }, "app-secret")), "218471");
  });

  it("keeps IDs that are too large for JavaScript numbers intact", () => {
    const raw = '{"algorithm":"HMAC-SHA256","user_id":17841405793187218}';
    assert.equal(verifier.userIdFrom(signedRequest(raw, "app-secret")), "17841405793187218");
  });

  it("rejects wrong signatures and garbage", () => {
    assert.equal(verifier.userIdFrom(signedRequest({ algorithm: "HMAC-SHA256", user_id: "218471" }, "other-secret")), null);
    assert.equal(verifier.userIdFrom("not-a-signed-request"), null);
    assert.equal(verifier.userIdFrom(""), null);
  });
});

describe("Production config", () => {
  const secrets = { SESSION_SECRET: "s", TOKEN_ENCRYPTION_KEY: "k" };

  it("refuses to start in production without HTTPS", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "production", APP_URL: "http://houses.example", ...secrets }), /https:\/\//);
    assert.equal(loadConfig({ NODE_ENV: "production", APP_URL: "https://houses.example", ...secrets }).security.secureCookies, true);
  });
});

describe("ThreadsPostSource", () => {
  it("never sends the access token to a paging link outside the Threads API", async () => {
    const requested: string[] = [];
    const http = (async (url: string | URL | Request) => {
      requested.push(String(url));
      return Response.json({ data: [], paging: { next: "https://evil.example/steal?access_token=secret" } });
    }) as typeof fetch;
    const source = new ThreadsPostSource("secret", http);

    await assert.rejects(source.replies("123", 3), /unexpected paging link/);
    assert.equal(requested.length, 1);
    assert.ok(requested.every((url) => url.startsWith("https://graph.threads.net/")));
  });
});
