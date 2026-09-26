import { RefreshJob } from "./application/refresh-job.js";
import { DEFAULT_SEARCH_TERMS } from "./application/search-terms.js";
import { CheckDeletion, DeleteUserData, DisconnectThreads } from "./application/use-cases/delete-user-data.js";
import { GetAccount } from "./application/use-cases/get-account.js";
import { GetSystemStatus } from "./application/use-cases/get-system-status.js";
import { PruneOldListings } from "./application/use-cases/prune-old-listings.js";
import { RefreshListings } from "./application/use-cases/refresh-listings.js";
import { RenewAccessTokens } from "./application/use-cases/renew-access-tokens.js";
import { ResolvePlace } from "./application/use-cases/resolve-place.js";
import { SearchNearbyListings } from "./application/use-cases/search-nearby-listings.js";
import { ThreadsLogin } from "./application/use-cases/threads-login.js";
import { Alerts } from "./infrastructure/alerts.js";
import { loadConfig, loadEnvFile } from "./infrastructure/config.js";
import { NominatimGeocoder } from "./infrastructure/geocoding/nominatim-geocoder.js";
import { openDatabase } from "./infrastructure/persistence/database.js";
import { SqliteCredentialStore } from "./infrastructure/persistence/sqlite-credential-store.js";
import { SqliteDeletionLog } from "./infrastructure/persistence/sqlite-deletion-log.js";
import { SqliteListingRepository } from "./infrastructure/persistence/sqlite-listing-repository.js";
import { SqliteSessionStore } from "./infrastructure/persistence/sqlite-session-store.js";
import { SqliteUserRepository } from "./infrastructure/persistence/sqlite-user-repository.js";
import { MetaSignedRequestVerifier } from "./infrastructure/security/meta-signed-request.js";
import { TokenCipher } from "./infrastructure/security/token-cipher.js";
import { systemClock as clock } from "./infrastructure/system-clock.js";
import { ThreadsAuthProvider } from "./infrastructure/threads/threads-auth-provider.js";
import { ThreadsPostSourceFactory } from "./infrastructure/threads/threads-post-source.js";
import { buildHttpServer } from "./interfaces/http/server.js";

const TOKEN_RENEWAL_INTERVAL_MS = 12 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

loadEnvFile();
const config = loadConfig();

const alerts = new Alerts(config.alertWebhookUrl);
const db = openDatabase(config.storage.databasePath);
const users = new SqliteUserRepository(db);
const credentials = new SqliteCredentialStore(db, new TokenCipher(config.security.tokenEncryptionKey));
const listings = new SqliteListingRepository(db);
const deletions = new SqliteDeletionLog(db);
const auth = new ThreadsAuthProvider(config.threads, clock);
const geocoder = new NominatimGeocoder(config.geocoding);

const refreshJob = new RefreshJob(
  new RefreshListings(new ThreadsPostSourceFactory(), geocoder, listings, credentials, clock, {
    searchTerms: DEFAULT_SEARCH_TERMS,
    maxGeocodesPerRun: config.geocoding.maxLookupsPerRefresh,
    placesTriedPerListing: 4,
    readComments: config.threads.readComments,
    maxCommentFetchesPerRun: config.threads.maxCommentFetchesPerRefresh,
    commentPagesPerPost: 2,
    checkpointEvery: 25,
  }),
  clock,
  (error) => {
    server.log.error(error, "Refresh failed unexpectedly");
    void alerts.notify("A refresh failed unexpectedly", error);
  },
);
const renewTokens = new RenewAccessTokens(auth, credentials, clock);
const pruneListings = new PruneOldListings(listings, clock, config.storage.listingRetentionDays);

const server = await buildHttpServer(
  {
    threadsLogin: new ThreadsLogin(auth, users, credentials, clock),
    getAccount: new GetAccount(users, credentials, clock),
    deleteUserData: new DeleteUserData(users, credentials, listings, deletions, clock),
    disconnect: new DisconnectThreads(credentials),
    checkDeletion: new CheckDeletion(deletions),
    searchNearby: new SearchNearbyListings(listings, clock),
    resolvePlace: new ResolvePlace(geocoder),
    refreshJob,
    getSystemStatus: new GetSystemStatus(listings, credentials, clock),
  },
  {
    appUrl: config.appUrl,
    corsOrigin: config.http.corsOrigin,
    sessionSecret: config.security.sessionSecret,
    secureCookies: config.security.secureCookies,
    signedRequests: new MetaSignedRequestVerifier(config.threads.appSecret),
    logger: true,
    trustProxy: config.http.trustProxy,
    sessionStore: new SqliteSessionStore(db),
    onUnexpectedError: (error) => void alerts.notify("The API answered 500", error),
  },
);

for (const warning of config.warnings) server.log.warn(warning);
if (!auth.isConfigured()) server.log.warn("THREADS_APP_ID / THREADS_APP_SECRET aren't set: Log in with Threads is unavailable.");

const renew = () =>
  renewTokens
    .execute()
    .then(({ renewed, failed }) => (renewed || failed.length) && server.log.info({ renewed, failed }, "Renewed Threads tokens"))
    .catch((error: unknown) => {
      server.log.error(error, "Token renewal failed");
      void alerts.notify("Token renewal failed", error);
    });
void renew();
setInterval(renew, TOKEN_RENEWAL_INTERVAL_MS).unref();

const prune = () =>
  pruneListings
    .execute()
    .then((deleted) => deleted && server.log.info({ deleted }, "Deleted old listings"))
    .catch((error: unknown) => {
      server.log.error(error, "Deleting old listings failed");
      void alerts.notify("Deleting old listings failed", error);
    });
void prune();
setInterval(prune, PRUNE_INTERVAL_MS).unref();

for (const event of ["uncaughtException", "unhandledRejection"] as const) {
  process.on(event, (error: unknown) => {
    server.log.fatal(error, event);
    void alerts.notify(`The backend crashed (${event})`, error).finally(() => process.exit(1));
  });
}

await server.listen({ port: config.http.port, host: config.http.host });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().then(() => {
      db.close();
      process.exit(0);
    });
  });
}
