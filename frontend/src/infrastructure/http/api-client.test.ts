import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BackendUnavailableError, NotSignedInError, RequestRejectedError } from "@/application/errors";
import { ApiClient } from "./api-client";
import { HttpAuthGateway } from "./gateways";

const json = (status: number, body: unknown) => async () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ApiClient", () => {
  it("returns the body of successful responses", async () => {
    assert.deepEqual(await new ApiClient("/api", json(200, { ok: true })).get("/status"), { ok: true });
  });

  it("passes the backend's error message on", async () => {
    const client = new ApiClient("/api", json(404, { error: "No place found for \"Atlantis\"." }));
    await assert.rejects(client.get("/places", { q: "Atlantis" }), (error) => {
      assert.ok(error instanceof RequestRejectedError);
      assert.equal(error.status, 404);
      assert.equal(error.message, "No place found for \"Atlantis\".");
      return true;
    });
  });

  it("treats network failures and non-API error pages as an unavailable backend", async () => {
    const offline = new ApiClient("/api", async () => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(offline.get("/status"), BackendUnavailableError);

    const proxyErrorPage = new ApiClient("/api", async () => new Response("Internal Server Error", { status: 500 }));
    await assert.rejects(proxyErrorPage.get("/status"), BackendUnavailableError);
  });

  it("leaves undefined values out of the query string", async () => {
    let requested = "";
    const client = new ApiClient("/api", async (input) => {
      requested = String(input);
      return new Response("{}");
    });
    await client.get("/listings", { lat: undefined, radiusKm: 10, kind: "all" });
    assert.equal(requested, "/api/listings?radiusKm=10&kind=all");
  });
});

describe("ApiClient and sessions", () => {
  it("reports a missing session as NotSignedInError", async () => {
    const client = new ApiClient("/api", json(401, { error: "Log in to continue.", code: "not_signed_in" }));
    await assert.rejects(client.get("/status"), NotSignedInError);
  });

  it("keeps other 401s, such as an expired Threads login, as rejections with their code", async () => {
    const client = new ApiClient("/api", json(401, { error: "Log in with Threads to refresh listings.", code: "threads_login_required" }));
    await assert.rejects(client.post("/refresh", { days: 30 }), (error) => {
      assert.ok(error instanceof RequestRejectedError);
      assert.equal(error.code, "threads_login_required");
      return true;
    });
  });
});

describe("HttpAuthGateway", () => {
  it("returns null instead of throwing when nobody is logged in", async () => {
    const gateway = new HttpAuthGateway(new ApiClient("/api", json(401, { error: "Log in to continue.", code: "not_signed_in" })), "/api");
    assert.equal(await gateway.currentAccount(), null);
    assert.equal(gateway.threadsLoginUrl, "/api/auth/threads/login");
  });

  it("maps the login options", async () => {
    const gateway = new HttpAuthGateway(new ApiClient("/api", json(200, { threadsLogin: true })), "/api");
    assert.deepEqual(await gateway.options(), { threads: true });
  });
});
