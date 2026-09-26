import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RefreshStatus } from "@/domain/refresh";
import type { RefreshGateway } from "./ports";
import { watchRefresh } from "./watch-refresh";

const running = (done: number): RefreshStatus => ({ state: "running", phase: "reading", done, total: 3 });
const finished: RefreshStatus = {
  state: "done",
  finishedAt: new Date(),
  postsFound: 3,
  added: 2,
  located: 2,
  commentsRead: 1,
  geocodeLimitReached: false,
  commentLimitReached: false,
};

function gatewayAnswering(...statuses: RefreshStatus[]): RefreshGateway {
  return { start: async () => running(0), current: async () => statuses.shift() ?? finished };
}

const describeStatus = (status: RefreshStatus) => (status.state === "running" ? `running ${status.done}` : status.state);
const noWait = async () => {};

describe("watchRefresh", () => {
  it("polls a running refresh until it finishes", async () => {
    const seen: string[] = [];
    const result = await watchRefresh(gatewayAnswering(running(1), running(2), finished), (s) => seen.push(describeStatus(s)), {
      intervalMs: 0,
      signal: new AbortController().signal,
      wait: noWait,
    });
    assert.equal(result, true);
    assert.deepEqual(seen, ["running 1", "running 2", "done"]);
  });

  it("reports once and stops when nothing is running", async () => {
    const seen: string[] = [];
    const result = await watchRefresh(gatewayAnswering({ state: "idle" }), (s) => seen.push(describeStatus(s)), {
      intervalMs: 0,
      signal: new AbortController().signal,
      wait: noWait,
    });
    assert.equal(result, false);
    assert.deepEqual(seen, ["idle"]);
  });

  it("counts a refresh it just started as finished, even if it ended before the first check", async () => {
    const result = await watchRefresh(gatewayAnswering(finished), () => {}, {
      intervalMs: 0,
      signal: new AbortController().signal,
      justStarted: true,
      wait: noWait,
    });
    assert.equal(result, true);
  });

  it("stops quietly once aborted", async () => {
    const controller = new AbortController();
    const result = await watchRefresh(gatewayAnswering(running(1), running(2)), () => {}, {
      intervalMs: 0,
      signal: controller.signal,
      wait: async () => controller.abort(),
    });
    assert.equal(result, false);
  });
});
