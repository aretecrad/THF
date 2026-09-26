import type { FastifyPluginAsync } from "fastify";
import type { RefreshJob } from "../../../application/refresh-job.js";
import type { DeleteUserData } from "../../../application/use-cases/delete-user-data.js";
import { presentAccount } from "../presenters.js";
import { currentUserId, type Sessions } from "../session.js";

export const accountRoutes =
  (deleteUserData: DeleteUserData, refreshJob: RefreshJob, sessions: Sessions): FastifyPluginAsync =>
  async (app) => {
    app.get("/me", async (request) => presentAccount(request.account!));

    app.delete("/me", async (request, reply) => {
      const userId = currentUserId(request);
      const deletion = await refreshJob.whileStopped(userId, () => deleteUserData.execute(userId));
      await sessions.endAllFor(userId);
      await sessions.end(request, reply);
      return { confirmationCode: deletion.confirmationCode };
    });
  };
