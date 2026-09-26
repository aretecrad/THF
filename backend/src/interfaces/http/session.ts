import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import type { SessionStore } from "../../application/ports/session-store.js";
import type { Account, GetAccount } from "../../application/use-cases/get-account.js";

declare module "fastify" {
  interface FastifyRequest {
    account: Account | null;
  }
}

export interface CookiePolicy {
  readonly secure: boolean;
}

const SESSION_COOKIE = "thf_session";
const LOGIN_STATE_COOKIE = "thf_login_state";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const LOGIN_STATE_MAX_AGE_SECONDS = 10 * 60;

const baseCookie = ({ secure }: CookiePolicy) => ({ path: "/", httpOnly: true, sameSite: "lax" as const, secure });

export class Sessions {
  constructor(
    private readonly store: SessionStore,
    private readonly policy: CookiePolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async start(reply: FastifyReply, userId: string): Promise<void> {
    await this.store.deleteExpired(this.now());
    const id = randomBytes(32).toString("base64url");
    await this.store.save(hash(id), { userId, expiresAt: new Date(this.now().getTime() + SESSION_MAX_AGE_SECONDS * 1000) });
    reply.setCookie(SESSION_COOKIE, id, { ...baseCookie(this.policy), maxAge: SESSION_MAX_AGE_SECONDS, signed: true });
  }

  async end(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const id = signedSessionId(request);
    if (id) await this.store.delete(hash(id));
    reply.clearCookie(SESSION_COOKIE, baseCookie(this.policy));
  }

  endAllFor(userId: string): Promise<void> {
    return this.store.deleteForUser(userId);
  }

  async userIdOf(request: FastifyRequest): Promise<string | null> {
    const id = signedSessionId(request);
    const session = id ? await this.store.find(hash(id)) : undefined;
    return session && session.expiresAt > this.now() ? session.userId : null;
  }
}

const hash = (sessionId: string) => createHash("sha256").update(sessionId).digest("base64url");

export function rememberLoginState(reply: FastifyReply, state: string, policy: CookiePolicy): void {
  reply.setCookie(LOGIN_STATE_COOKIE, state, { ...baseCookie(policy), maxAge: LOGIN_STATE_MAX_AGE_SECONDS, signed: true });
}

export function takeLoginState(request: FastifyRequest, reply: FastifyReply, policy: CookiePolicy): string | null {
  reply.clearCookie(LOGIN_STATE_COOKIE, baseCookie(policy));
  return readSigned(request, LOGIN_STATE_COOKIE);
}

export function requireUser(getAccount: GetAccount, sessions: Sessions): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const userId = await sessions.userIdOf(request);
    const account = userId ? await getAccount.execute(userId) : undefined;
    if (!account) {
      await sessions.end(request, reply);
      await reply.code(401).send({ error: "Log in to continue.", code: "not_signed_in" });
      return;
    }
    request.account = account;
  };
}

export function currentUserId(request: FastifyRequest): string {
  if (!request.account) throw new Error("currentUserId() used on a route without requireUser.");
  return request.account.user.id;
}

export function signedSessionId(request: FastifyRequest): string | null {
  return readSigned(request, SESSION_COOKIE);
}

function readSigned(request: FastifyRequest, name: string): string | null {
  const raw = request.cookies[name];
  if (!raw) return null;
  const { valid, value } = request.unsignCookie(raw);
  return valid ? value : null;
}
