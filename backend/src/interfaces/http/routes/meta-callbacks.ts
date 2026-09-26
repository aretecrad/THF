import type { FastifyPluginAsync } from "fastify";
import type { RefreshJob } from "../../../application/refresh-job.js";
import type { CheckDeletion, DeleteUserData, DisconnectThreads } from "../../../application/use-cases/delete-user-data.js";
import type { Sessions } from "../session.js";

export interface SignedRequestVerifier {
  userIdFrom(signedRequest: string): string | null;
}

interface SignedBody {
  readonly signed_request?: string;
}

export const metaCallbackRoutes =
  (
    useCases: { disconnect: DisconnectThreads; deleteUserData: DeleteUserData; checkDeletion: CheckDeletion; refreshJob: RefreshJob },
    verifier: SignedRequestVerifier,
    sessions: Sessions,
    appUrl: string,
  ): FastifyPluginAsync =>
  async (app) => {
    app.post<{ Body: SignedBody }>("/threads/deauthorize", async (request, reply) => {
      const userId = verifier.userIdFrom(request.body?.signed_request ?? "");
      if (!userId) return reply.code(400).send({ error: "Invalid signed_request." });
      await useCases.disconnect.execute(userId);
      return { ok: true };
    });

    app.post<{ Body: SignedBody }>("/threads/data-deletion", async (request, reply) => {
      const userId = verifier.userIdFrom(request.body?.signed_request ?? "");
      if (!userId) return reply.code(400).send({ error: "Invalid signed_request." });
      const { confirmationCode } = await useCases.refreshJob.whileStopped(userId, () => useCases.deleteUserData.execute(userId));
      await sessions.endAllFor(userId);
      return { url: `${appUrl}/api/threads/data-deletion/status?code=${confirmationCode}`, confirmation_code: confirmationCode };
    });

    app.get<{ Querystring: { code?: string } }>("/threads/data-deletion/status", async (request, reply) => {
      const record = request.query.code ? await useCases.checkDeletion.execute(request.query.code) : undefined;
      reply.type("text/plain; charset=utf-8");
      if (!record) return reply.code(404).send("No data deletion request was found with this confirmation code.");
      return `Deletion request ${record.confirmationCode}: all data stored about you (account, Threads access token and saved listings) was deleted on ${record.completedAt.toISOString()}.`;
    });
  };
