import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDueForRenewal, isExpired } from "../../src/domain/credential.js";
import { aCredential, DAY } from "../support/fakes.js";

const now = new Date("2026-09-24T00:00:00Z");
const issuedDaysAgo = (days: number) => aCredential(new Date(now.getTime() - days * DAY));

describe("Credential", () => {
  it("expires after 60 days", () => {
    assert.equal(isExpired(issuedDaysAgo(59), now), false);
    assert.equal(isExpired(issuedDaysAgo(60), now), true);
  });

  it("is renewed weekly while still valid", () => {
    assert.equal(isDueForRenewal(issuedDaysAgo(0.5), now), false);
    assert.equal(isDueForRenewal(issuedDaysAgo(6), now), false);
    assert.equal(isDueForRenewal(issuedDaysAgo(7), now), true);
    assert.equal(isDueForRenewal(issuedDaysAgo(61), now), false);
  });
});
