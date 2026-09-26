import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Alerts } from "../../src/infrastructure/alerts.js";

describe("Alerts", () => {
  it("posts to the webhook, and doesn't repeat the same alert within 10 minutes", async () => {
    const sent: Array<{ url: string; body: { text: string; content: string } }> = [];
    const http = (async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    let now = 0;
    const alerts = new Alerts("https://hooks.example/abc", http, () => now);

    await alerts.notify("The API answered 500", new Error("database is locked"));
    await alerts.notify("The API answered 500", new Error("database is locked"));
    now += 10 * 60 * 1000;
    await alerts.notify("The API answered 500", new Error("database is locked"));

    assert.equal(sent.length, 2);
    assert.equal(sent[0]?.url, "https://hooks.example/abc");
    assert.match(sent[0]?.body.text ?? "", /^\[THF\] The API answered 500\nError: database is locked/);
    assert.equal(sent[0]?.body.content, sent[0]?.body.text);
  });

  it("does nothing without a webhook", async () => {
    const http = (async () => assert.fail("no request expected")) as typeof fetch;
    await new Alerts(undefined, http).notify("anything");
  });
});
