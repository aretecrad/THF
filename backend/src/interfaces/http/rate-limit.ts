import type { FastifyRequest, onRequestAsyncHookHandler } from "fastify";
import { signedSessionId } from "./session.js";

export function rateLimit(max: number, windowMs = 60_000, now: () => number = Date.now): onRequestAsyncHookHandler {
  let windowStart = now();
  let counts = new Map<string, number>();

  return async (request, reply) => {
    if (now() - windowStart >= windowMs) {
      windowStart = now();
      counts = new Map();
    }
    const key = clientKey(request);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > max) {
      reply.header("retry-after", Math.ceil((windowStart + windowMs - now()) / 1000));
      return reply.code(429).send({ error: "Too many requests. Wait a minute and try again." });
    }
  };
}

const clientKey = (request: FastifyRequest) => {
  const session = signedSessionId(request);
  return session ? `session:${session}` : `ip:${request.ip}`;
};
