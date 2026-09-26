import { randomBytes } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { ThreadsLogin } from "../../../application/use-cases/threads-login.js";
import { rememberLoginState, takeLoginState, type CookiePolicy, type Sessions } from "../session.js";

interface AuthRouteOptions {
  readonly appUrl: string;
  readonly cookies: CookiePolicy;
  readonly sessions: Sessions;
}

interface CallbackQuery {
  readonly code?: string;
  readonly state?: string;
  readonly error?: string;
}

type LoginError = "unavailable" | "denied" | "expired" | "failed";

export const authRoutes =
  (threadsLogin: ThreadsLogin, options: AuthRouteOptions): FastifyPluginAsync =>
  async (app) => {
    const backToApp = (error?: LoginError) => `${options.appUrl}/${error ? `?login_error=${error}` : ""}`;

    app.get("/auth/options", async () => ({ threadsLogin: threadsLogin.isAvailable() }));

    app.get("/auth/threads/login", async (_request, reply) => {
      if (!threadsLogin.isAvailable()) return reply.redirect(backToApp("unavailable"));
      const state = randomBytes(16).toString("base64url");
      rememberLoginState(reply, state, options.cookies);
      return reply.redirect(threadsLogin.authorizationUrl(state));
    });

    app.get<{ Querystring: CallbackQuery }>("/auth/threads/callback", async (request, reply) => {
      const { code, state, error } = request.query;
      const expectedState = takeLoginState(request, reply, options.cookies);
      if (error) return reply.redirect(backToApp("denied"));
      if (!code || !state || state !== expectedState) return reply.redirect(backToApp("expired"));

      try {
        const user = await threadsLogin.complete(code);
        await options.sessions.start(reply, user.id);
        return reply.redirect(backToApp());
      } catch (failure) {
        request.log.error(failure, "Threads login failed");
        return reply.redirect(backToApp("failed"));
      }
    });

    app.post("/auth/logout", async (request, reply) => {
      await options.sessions.end(request, reply);
      return reply.code(204).send();
    });
  };
