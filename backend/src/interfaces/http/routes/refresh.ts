import type { FastifyPluginAsync } from "fastify";
import type { RefreshJob } from "../../../application/refresh-job.js";
import { presentRefreshStatus } from "../presenters.js";
import { currentUserId } from "../session.js";
import { refreshBodySchema, type RefreshBody } from "../schemas.js";

export const refreshRoutes =
  (refreshJob: RefreshJob): FastifyPluginAsync =>
  async (app) => {
    app.get("/refresh", async (request) => presentRefreshStatus(refreshJob.current(currentUserId(request))));

    app.post<{ Body: RefreshBody }>("/refresh", { schema: { body: refreshBodySchema } }, async (request, reply) => {
      const status = await refreshJob.start(currentUserId(request), { days: request.body.days, pagesPerSearch: request.body.pages });
      return reply.code(202).send(presentRefreshStatus(status));
    });
  };
