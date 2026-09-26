import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlacesGateway } from "./ports";
import { resolveEndPoint } from "./resolve-end-point";

function fakePlaces() {
  const queries: string[] = [];
  const places: PlacesGateway = {
    find: async (query) => {
      queries.push(query);
      return { point: { lat: -6.202, lng: 106.823 }, name: `${query}, Jalan Jenderal Sudirman, Jakarta, Indonesia` };
    },
  };
  return { places, queries };
}

describe("resolveEndPoint", () => {
  it("uses typed coordinates without looking anything up", async () => {
    const { places, queries } = fakePlaces();
    const endPoint = await resolveEndPoint(" -6.2297, 106.8295 ", places);
    assert.deepEqual(endPoint, { point: { lat: -6.2297, lng: 106.8295 }, label: "Entered coordinates" });
    assert.deepEqual(queries, []);
  });

  it("looks up anything else and keeps the first two parts of the name", async () => {
    const { places } = fakePlaces();
    const endPoint = await resolveEndPoint("  Stasiun Sudirman ", places);
    assert.deepEqual(endPoint, { point: { lat: -6.202, lng: 106.823 }, label: "Stasiun Sudirman, Jalan Jenderal Sudirman" });
  });
});
