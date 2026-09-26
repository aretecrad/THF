import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import Fastify, { type FastifyInstance } from "fastify";
import type { SessionStore } from "../../application/ports/session-store.js";
import type { RefreshJob } from "../../application/refresh-job.js";
import type { CheckDeletion, DeleteUserData, DisconnectThreads } from "../../application/use-cases/delete-user-data.js";
import type { GetAccount } from "../../application/use-cases/get-account.js";
import type { GetSystemStatus } from "../../application/use-cases/get-system-status.js";
import type { ResolvePlace } from "../../application/use-cases/resolve-place.js";
import type { SearchNearbyListings } from "../../application/use-cases/search-nearby-listings.js";
import type { ThreadsLogin } from "../../application/use-cases/threads-login.js";
import { handleError } from "./error-handler.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { listingsRoutes } from "./routes/listings.js";
import { metaCallbackRoutes, type SignedRequestVerifier } from "./routes/meta-callbacks.js";
import { placesRoutes } from "./routes/places.js";
import { refreshRoutes } from "./routes/refresh.js";
import { statusRoutes } from "./routes/status.js";
import { rateLimit } from "./rate-limit.js";
import { requireUser, Sessions } from "./session.js";

interface HttpUseCases {
  readonly threadsLogin: ThreadsLogin;
  readonly getAccount: GetAccount;
  readonly deleteUserData: DeleteUserData;
  readonly disconnect: DisconnectThreads;
  readonly checkDeletion: CheckDeletion;
  readonly searchNearby: SearchNearbyListings;
  readonly resolvePlace: ResolvePlace;
  readonly refreshJob: RefreshJob;
  readonly getSystemStatus: GetSystemStatus;
}

interface HttpOptions {
  readonly appUrl: string;
  readonly corsOrigin: string;
  readonly sessionSecret: string;
  readonly secureCookies: boolean;
  readonly signedRequests: SignedRequestVerifier;
  readonly logger: boolean;
  readonly trustProxy: boolean | string;
  readonly sessionStore: SessionStore;
  readonly onUnexpectedError?: (error: unknown) => void;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const REQUESTS_PER_MINUTE = 300;

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-resource-policy": "same-origin",
};

export async function buildHttpServer(useCases: HttpUseCases, options: HttpOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger, disableRequestLogging: true, trustProxy: options.trustProxy });
  await app.register(cors, { origin: options.corsOrigin, credentials: true });
  await app.register(cookie, { secret: options.sessionSecret });
  await app.register(formbody);
  app.decorateRequest("account", null);
  app.setErrorHandler(handleError(options.onUnexpectedError ?? (() => {})));
  const appOrigin = new URL(options.appUrl).origin;
  app.addHook("onRequest", async (request, reply) => {
    const { origin } = request.headers;
    if (!origin || origin === appOrigin || SAFE_METHODS.has(request.method) || request.url.startsWith("/api/threads/")) return;
    return reply.code(403).send({ error: "Requests from other sites aren't allowed." });
  });
  const hsts = options.secureCookies && new URL(options.appUrl).hostname !== "localhost";
  app.addHook("onSend", async (_request, reply) => {
    reply.headers(SECURITY_HEADERS);
    if (hsts) reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  });

  const cookies = { secure: options.secureCookies };
  const sessions = new Sessions(options.sessionStore, cookies);
  await app.register(
    async (api) => {
      api.get("/health", async () => ({ ok: true }));

      await api.register(async (limitedApi) => {
        limitedApi.addHook("onRequest", rateLimit(REQUESTS_PER_MINUTE));

        await limitedApi.register(authRoutes(useCases.threadsLogin, { appUrl: options.appUrl, cookies, sessions }));
        await limitedApi.register(metaCallbackRoutes(useCases, options.signedRequests, sessions, options.appUrl));

        await limitedApi.register(async (userApi) => {
          userApi.addHook("preHandler", requireUser(useCases.getAccount, sessions));
          await userApi.register(accountRoutes(useCases.deleteUserData, useCases.refreshJob, sessions));
          await userApi.register(statusRoutes(useCases.getSystemStatus));
          await userApi.register(listingsRoutes(useCases.searchNearby));
          await userApi.register(placesRoutes(useCases.resolvePlace));
          await userApi.register(refreshRoutes(useCases.refreshJob));
        });
      });
    },
    { prefix: "/api" },
  );
  return app;
}
