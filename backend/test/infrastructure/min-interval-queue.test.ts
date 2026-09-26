import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MinIntervalQueue } from "../../src/infrastructure/geocoding/min-interval-queue.js";

describe("MinIntervalQueue", () => {
  it("spaces tasks out, runs urgent ones first, and survives failures", async () => {
    let clock = 0;
    const waits: number[] = [];
    const queue = new MinIntervalQueue(1000, () => clock, async (ms) => {
      waits.push(ms);
      clock += ms;
    });
    const order: string[] = [];
    const task = (name: string) => async () => {
      order.push(name);
      if (name === "b1") throw new Error("boom");
      return name;
    };

    const results = [
      queue.run(task("b1")),
      queue.run(task("b2")),
      queue.run(task("u1"), { urgent: true }),
    ];
    const settled = await Promise.allSettled(results);

    assert.deepEqual(order, ["b1", "u1", "b2"]);
    assert.deepEqual(waits, [1000, 1000]);
    assert.deepEqual(settled.map((s) => s.status), ["rejected", "fulfilled", "fulfilled"]);
  });
});
