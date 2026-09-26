import { randomBytes } from "node:crypto";
import { parseGeoPoint, type GeoPoint } from "../domain/geo-point.js";

interface AppConfig {
  readonly http: { readonly port: number; readonly host: string; readonly corsOrigin: string; readonly trustProxy: boolean | string };
  readonly appUrl: string;
  readonly threads: {
    readonly appId: string;
    readonly appSecret: string;
    readonly redirectUri: string;
    readonly scopes: readonly string[];
    readonly readComments: boolean;
    readonly maxCommentFetchesPerRefresh: number;
  };
  readonly security: {
    readonly sessionSecret: string;
    readonly tokenEncryptionKey: string;
    readonly secureCookies: boolean;
  };
  readonly geocoding: {
    readonly countryCode?: string;
    readonly bias?: GeoPoint;
    readonly contactEmail?: string;
    readonly maxLookupsPerRefresh: number;
  };
  readonly storage: {
    readonly databasePath: string;
    readonly listingRetentionDays: number;
  };
  readonly alertWebhookUrl?: string;
  readonly warnings: readonly string[];
}

const DEFAULT_SCOPES = ["threads_basic", "threads_keyword_search", "threads_read_replies"];

export function loadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch {
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const warnings: string[] = [];
  const production = env.NODE_ENV === "production";
  const appUrl = (env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (production && !appUrl.startsWith("https://")) throw new Error(`APP_URL must start with https:// in production (got "${appUrl}").`);

  const secret = (name: string, consequence: string): string => {
    const value = env[name];
    if (value) return value;
    if (production) throw new Error(`${name} must be set in production. Generate one with: openssl rand -base64 32`);
    warnings.push(`${name} isn't set, so a temporary one is used: ${consequence} after a restart.`);
    return randomBytes(32).toString("base64");
  };

  return {
    http: {
      port: toInteger(env.PORT, 4000),
      host: env.HOST || "localhost",
      corsOrigin: env.CORS_ORIGIN || appUrl,
      trustProxy: env.TRUST_PROXY === "true" ? true : env.TRUST_PROXY || "loopback",
    },
    appUrl,
    threads: {
      appId: env.THREADS_APP_ID ?? "",
      appSecret: env.THREADS_APP_SECRET ?? "",
      redirectUri: env.THREADS_REDIRECT_URI || `${appUrl}/api/auth/threads/callback`,
      scopes: env.THREADS_SCOPES ? env.THREADS_SCOPES.split(",").map((scope) => scope.trim()) : DEFAULT_SCOPES,
      readComments: env.READ_COMMENTS !== "false",
      maxCommentFetchesPerRefresh: toInteger(env.MAX_COMMENT_FETCHES_PER_REFRESH, 100),
    },
    security: {
      sessionSecret: secret("SESSION_SECRET", "everyone will be logged out"),
      tokenEncryptionKey: secret("TOKEN_ENCRYPTION_KEY", "saved Threads logins can't be read and users must log in again"),
      secureCookies: appUrl.startsWith("https://"),
    },
    geocoding: {
      countryCode: env.GEO_COUNTRY || undefined,
      bias: parseGeoPoint(env.GEO_BIAS ?? "") ?? undefined,
      contactEmail: env.NOMINATIM_EMAIL || undefined,
      maxLookupsPerRefresh: toInteger(env.MAX_GEOCODE_PER_REFRESH, 400),
    },
    storage: {
      databasePath: env.DATABASE_PATH || "data/thf.db",
      listingRetentionDays: Math.max(1, toInteger(env.LISTING_RETENTION_DAYS, 365)),
    },
    alertWebhookUrl: env.ALERT_WEBHOOK_URL || undefined,
    warnings,
  };
}

function toInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
