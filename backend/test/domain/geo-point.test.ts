import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../../src/domain/errors.js";
import { createGeoPoint, distanceKm, parseGeoPoint } from "../../src/domain/geo-point.js";

describe("GeoPoint", () => {
  it("parses coordinate pairs and rejects everything else", () => {
    assert.deepEqual(parseGeoPoint(" -6.2297, 106.8295 "), { lat: -6.2297, lng: 106.8295 });
    assert.equal(parseGeoPoint("Kemang"), null);
    assert.equal(parseGeoPoint("95,10"), null);
  });

  it("refuses out-of-range coordinates", () => {
    assert.throws(() => createGeoPoint(-91, 0), ValidationError);
    assert.throws(() => createGeoPoint(0, 181), ValidationError);
  });

  it("measures great-circle distance", () => {
    assert.ok(Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.19) < 0.01);
    assert.equal(distanceKm({ lat: -6.2, lng: 106.8 }, { lat: -6.2, lng: 106.8 }), 0);
  });
});
