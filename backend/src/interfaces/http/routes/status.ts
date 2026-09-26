import type { FastifyPluginAsync } from "fastify";
import type { GetSystemStatus } from "../../../application/use-cases/get-system-status.js";
import { presentSystemStatus } from "../presenters.js";
import { currentUserId } from "../session.js";

export const statusRoutes =
  (getSystemStatus: GetSystemStatus): FastifyPluginAsync =>
  async (app) => {
    app.get("/status", async (request) => presentSystemStatus(await getSystemStatus.execute(currentUserId(request))));
  };
