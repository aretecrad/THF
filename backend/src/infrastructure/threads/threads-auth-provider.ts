import { UpstreamError } from "../../application/errors.js";
import type { AuthProvider, ThreadsProfile } from "../../application/ports/auth-provider.js";
import type { Clock } from "../../application/ports/clock.js";
import type { Credential } from "../../domain/credential.js";

type Fetch = typeof fetch;

interface ThreadsAppSettings {
  readonly appId: string;
  readonly appSecret: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
}

interface TokenResponse {
  readonly access_token: string;
  readonly expires_in?: number;
}

const AUTHORIZE_URL = "https://threads.com/oauth/authorize";
const TOKEN_URL = "https://graph.threads.com/oauth/access_token";
const EXCHANGE_URL = "https://graph.threads.net/access_token";
const REFRESH_URL = "https://graph.threads.net/refresh_access_token";
const PROFILE_URL = "https://graph.threads.net/v1.0/me";
const LONG_LIVED_SECONDS = 60 * 24 * 60 * 60;
const TIMEOUT_MS = 15_000;

export class ThreadsAuthProvider implements AuthProvider {
  constructor(
    private readonly app: ThreadsAppSettings,
    private readonly clock: Clock,
    private readonly http: Fetch = (input, init) => fetch(input, init),
  ) {}

  isConfigured(): boolean {
    return this.app.appId.length > 0 && this.app.appSecret.length > 0;
  }

  authorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.app.appId,
      redirect_uri: this.app.redirectUri,
      scope: this.app.scopes.join(","),
      response_type: "code",
      state,
    });
    return `${AUTHORIZE_URL}?${params}`;
  }

  async exchangeCode(code: string): Promise<Credential> {
    const shortLived = await this.request<TokenResponse>(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.app.appId,
        client_secret: this.app.appSecret,
        grant_type: "authorization_code",
        redirect_uri: this.app.redirectUri,
        code: code.replace(/#_$/, ""),
      }),
    });
    const exchange = new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: this.app.appSecret,
      access_token: shortLived.access_token,
    });
    return this.toCredential(await this.request<TokenResponse>(`${EXCHANGE_URL}?${exchange}`));
  }

  async renew(credential: Credential): Promise<Credential> {
    const params = new URLSearchParams({ grant_type: "th_refresh_token", access_token: credential.accessToken });
    return this.toCredential(await this.request<TokenResponse>(`${REFRESH_URL}?${params}`));
  }

  async profile(accessToken: string): Promise<ThreadsProfile> {
    const params = new URLSearchParams({ fields: "id,username,name,threads_profile_picture_url", access_token: accessToken });
    const me = await this.request<{ id: string; username: string; name?: string; threads_profile_picture_url?: string }>(`${PROFILE_URL}?${params}`);
    return { id: String(me.id), username: me.username, name: me.name, pictureUrl: me.threads_profile_picture_url };
  }

  private toCredential({ access_token, expires_in }: TokenResponse): Credential {
    const issuedAt = this.clock.now();
    return {
      accessToken: access_token,
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + (expires_in ?? LONG_LIVED_SECONDS) * 1000),
    };
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.http(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch((error: unknown) => {
      throw new UpstreamError(`Threads login: ${error instanceof Error ? error.message : String(error)}`);
    });
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string }; error_message?: string };
    const problem = body.error?.message ?? body.error_message;
    if (!response.ok || problem) throw new UpstreamError(`Threads login: ${problem ?? `HTTP ${response.status}`}`);
    return body as T;
  }
}
