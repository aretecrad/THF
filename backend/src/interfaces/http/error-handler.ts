import type { FastifyReply, FastifyRequest } from "fastify";
import { LoginRequiredError, NotConfiguredError, UpstreamError } from "../../application/errors.js";
import { NotFoundError, ValidationError } from "../../domain/errors.js";

type ErrorType = abstract new (...args: never[]) => Error;

const STATUS_BY_ERROR: ReadonlyArray<readonly [ErrorType, number]> = [
  [ValidationError, 400],
  [NotFoundError, 404],
  [UpstreamError, 502],
  [NotConfiguredError, 503],
];

export const handleError =
  (onUnexpected: (error: unknown) => void) =>
  (error: unknown, request: FastifyRequest, reply: FastifyReply): void => {
    if (error instanceof LoginRequiredError) {
      reply.code(401).send({ error: error.message, code: "threads_login_required" });
      return;
    }
    const known = STATUS_BY_ERROR.find(([type]) => error instanceof type);
    if (known) {
      reply.code(known[1]).send({ error: (error as Error).message });
      return;
    }

    const { statusCode, message } = error as { statusCode?: number; message?: string };
    if (statusCode && statusCode < 500) {
      reply.code(statusCode).send({ error: message });
      return;
    }

    request.log.error(error);
    onUnexpected(error);
    reply.code(500).send({ error: "Something went wrong on the server. Please try again later." });
  };
