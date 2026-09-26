# THF
Thread Housing Finder

Houses for sale and rent posted on Threads, ranked by distance from an end point you choose.

- `backend/` is Node.js + Fastify. It searches Threads, locates each post, stores listings, and ranks them by distance.
- `frontend/` is a Next.js dashboard with frosted-glass panels floating over a map. It calls the backend through `/api`.

## Run it

Use Node 22 or newer, and run each app in its own terminal.

```bash
# backend: http://localhost:4000
cd backend
cp .env.example .env     # see "Log in with Threads" below
npm install
npm run dev

# frontend: http://localhost:3000
cd frontend
npm install
npm run dev
```

The frontend forwards `/api/*` to `BACKEND_URL` (default `http://localhost:4000`). For `npm run build`, set `BACKEND_URL` at build time.

Both apps have unit tests that need no network or token: run `npm test` in each folder.

### Run it with Docker

Fill in `backend/.env` (with `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` set: the image runs with `NODE_ENV=production`), then:

```bash
PRIVACY_CONTACT_EMAIL=you@example.com docker compose up --build   # http://localhost:3000
```

Only the frontend is published; the backend is reachable only through it. Put an HTTPS proxy or tunnel in front for Meta's callbacks. The database lives in the `backend-data` volume, so it survives rebuilds. `GET /api/health` answers `{"ok":true}` for load balancers and uptime checks.

Docker is optional: any host that keeps one Node process running with a persistent disk works (a VPS with `pm2` or `systemd`, Railway or Render with a volume). Serverless hosting doesn't work for the backend.

Run **one** backend instance: the database is a single SQLite file, and rate limits and refresh progress are held in that process.

## Data, backups and alerts

- **Storage:** users, encrypted Threads tokens, listings, sessions and the deletion log are kept in a SQLite file, `backend/data/thf.db` by default (`DATABASE_PATH`). It uses Node's built-in `node:sqlite`, so there's no database server to run. Restarts and deploys keep everyone logged in.
- **Old listings:** once a day, listings posted more than `LISTING_RETENTION_DAYS` ago (default 365) are deleted. Listings without a post date use the date they were fetched.
- **Backups:** copy the database safely while the backend runs with the `sqlite3` tool (`sudo apt install sqlite3`), for example daily from cron, and keep the copies on another machine:

  ```bash
  sqlite3 backend/data/thf.db ".backup backups/thf-$(date +%F).db"
  ```

  Don't copy `thf.db` with `cp` while the backend runs: recent writes may still be in `thf.db-wal`.
- **Alerts:** set `ALERT_WEBHOOK_URL` to a Slack or Discord incoming webhook. Crashes, `500` errors and failed background jobs (refreshes, token renewal, listing cleanup) are posted there, with the same alert sent at most once every 10 minutes.
- **Uptime:** point an uptime monitor (for example UptimeRobot) at `APP_URL/api/health`.

## Log in with Threads

Each user logs in with their own Threads account. Searches run with their own access token and count against their own daily quota, and each user's listings are private to them.

### Set up the Meta app

1. **Create the app.** At developers.facebook.com, create an app with the **Access the Threads API** use case.
2. **Add permissions.** Under Use cases, add `threads_keyword_search` and `threads_read_replies`. (`threads_basic` is always included.)
3. **Add three URLs.** Under Settings, add these, replacing `APP_URL` with where the dashboard is served:
   - Valid OAuth redirect URI: `APP_URL/api/auth/threads/callback`
   - Deauthorize callback URL: `APP_URL/api/threads/deauthorize`
   - Data Deletion Requests URL: `APP_URL/api/threads/data-deletion`
4. **Fill in `backend/.env`.**
   - Copy the **Threads** app ID and secret into `THREADS_APP_ID` and `THREADS_APP_SECRET`. Use the Threads pair, not the Facebook one.
   - Set `APP_URL`. In production it must start with `https://`, or the backend refuses to start.
   - Generate `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.
5. **Add yourself as a tester.** Before App Review, only people with a role on the app can log in. Add your own Threads account under App roles > Roles > Add People > **Threads Tester**. Then accept the invite in Threads under Settings > Account > Website permissions.

Meta requires HTTPS for its callbacks. For local testing, expose the frontend through an HTTPS tunnel (for example `cloudflared tunnel --url http://localhost:3000`) and use that address as `APP_URL`.

### How logins stay alive

- A login gives a 60-day token. The backend renews tokens weekly, which also keeps the user's permission grant alive.
- Logins, sessions and listings are stored in the database, so restarting the backend logs nobody out.
- Users with **private** Threads profiles must log in again every 90 days; Meta doesn't allow extending their grant.
- Tokens are stored encrypted with AES-256-GCM.
- Sessions live on the server: logging out or deleting your data ends them, and a copied cookie stops working. The database stores only a hash of each session ID.
- The session cookie is signed, HTTP-only and holds only a random session ID.
- The login uses a one-time `state` value to block forged callbacks.
- Writes (POST, DELETE) sent from another site are refused with `403`, on top of the `SameSite` cookie.

### App Review: letting anyone log in

App Review is how Meta approves each permission for users who have no role on your app. Until your permissions are approved and the app is published, only testers can log in. After that, anyone with a Threads account can.

1. **Host the app publicly over HTTPS.** Meta's reviewers test it themselves, and a submission they can't open is rejected.
2. **Prepare the app assets:**
   - an app icon, 512–1024 px;
   - the privacy policy URL `APP_URL/privacy` (this app includes one; set `PRIVACY_CONTACT_EMAIL` for the frontend so it shows your contact address);
   - the data deletion URL from step 3 above.
3. **Explain and record each permission.** For every permission you request, describe how the app uses it and include a screen recording of it in use:
   - `threads_basic`: logging in and showing your username.
   - `threads_keyword_search`: refreshing listings.
   - `threads_read_replies`: prices and places filled in from sellers' comments.
4. **Give reviewers clear steps:** log in with Threads, set an end point, press Refresh listings.
5. **Submit, then publish.** After approval, switch the app to Live.

### Data deletion

Meta requires every app to delete a user's data on request. When a user removes the app in Threads and asks for deletion, Meta posts a signed request to `/api/threads/data-deletion`. The backend checks the signature, cancels any running refresh, deletes the user's listings, token, account and sessions, and answers with a confirmation code and a status link. The dashboard's **Delete my data** button (`DELETE /api/me`) does the same.

## Architecture

Both apps use the same layering. Dependencies only point inward:

```
interfaces / presentation  ->  application  ->  domain
infrastructure             ->  application  ->  domain
```

| Layer | Backend (`backend/src`) | Frontend (`frontend/src`) |
| --- | --- | --- |
| **domain**: business rules, no I/O | `Listing`, `GeoPoint`, `User`, `Credential`, listing classifier, place extractor, distance ranking | `Listing`, `SearchCriteria`, `RefreshStatus`, criteria validation |
| **application**: use cases and the ports they need | `ThreadsLogin`, `RenewAccessTokens`, `DeleteUserData`, `SearchNearbyListings`, `RefreshListings`, `RefreshJob`, `PruneOldListings`, …; ports `AuthProvider`, `CredentialStore`, `SessionStore`, `PostSourceFactory`, `Geocoder`, `ListingRepository`, `Clock` | `resolveEndPoint`, `watchRefresh`; ports for listings, places, refresh, location |
| **infrastructure**: adapters for the ports | Threads OAuth and API, OpenStreetMap Nominatim, SQLite storage for users, encrypted tokens, listings, sessions and the deletion log, token encryption, webhook alerts, config | HTTP gateways with DTO mappers, browser geolocation |
| **interfaces / presentation** | Fastify routes, server-side sessions, rate limits, security headers, Meta callbacks, schemas, presenters, error mapping | React hooks and components, UI copy |
| **composition root** | `src/main.ts` | `src/composition/create-services.ts` |

Only the composition roots know which adapter backs each port. That's why the tests can swap in fakes: `backend/test/support/fakes.ts`, or a fake `fetch` in the frontend.

To change where data comes from or goes, write a new adapter and wire it into the composition root. Examples:

- Postgres instead of SQLite: implement `UserRepository`, `CredentialStore`, `ListingRepository`, `DeletionLog` and `SessionStore`.
- Google geocoding instead of OpenStreetMap: implement `Geocoder`.

## How a refresh works

1. `POST /api/refresh` starts a background job. It runs recent and top searches for every term in `backend/src/application/search-terms.ts`: 22 searches in total. Only one refresh runs per user at a time.
2. Each post is sorted into one of three types: an offer, someone looking for a house, or unrelated.
3. **Comments are read** (with `READ_COMMENTS=true`) in two cases:
   - An offer is missing its price or its place. Only the **seller's own comments** fill the gap, including short answers such as "Depok kak". Other people's comments never set a listing's details, so a buyer asking "Di Bekasi ya kak?" can't change the location.
   - Someone is looking for a house. Offers that other people leave as comments become listings of their own, completed the same way from their own later comments.
4. The job finds a location for each listing, in this order:
   - the post's location tag;
   - a place named in the listing itself;
   - a place named in the seller's comments.
5. Anything still missing is stored as missing, and the dashboard shows it as **N/A**:
   - Listings without a location can't be ranked by distance, so they're listed at the end under "Location N/A".
   - Each listing notes when its price or location came from a comment.
6. Complete listings are skipped on later refreshes. Listings with N/A details are checked again, since sellers often answer in the comments later.

## Things to know

- **Before App Review:** Threads keyword search only returns the logged-in tester's own posts. To try the real flow before approval, post a couple of listings from your tester account.
- **Failed refreshes:** problems with Threads (quota, expired login) are shown to the user as they are. Anything unexpected shows a general "try again later" message, and the details go to the logs and the alert webhook.
- **Comments:** if comments can't be read (for example, `threads_read_replies` isn't approved yet), the refresh still finishes and the dashboard says why.
- **Quota:** each refresh uses about 22–44 of your 2,200 daily Threads searches.
- **Comment reads:** each post's comments cost one extra API call. A refresh reads comments for at most `MAX_COMMENT_FETCHES_PER_REFRESH` posts (default 100).
- **Geocoding:** OpenStreetMap allows 1 lookup per second for the whole app. Lookups are queued and cached in memory, searches typed in the dashboard go ahead of refreshes, and each refresh is capped at `MAX_GEOCODE_PER_REFRESH` lookups. Heavy traffic needs a paid or self-hosted geocoder.
- **Rate limits:** each logged-in session (or, when logged out, each IP) gets 300 API requests and 20 place searches per minute, then `429`. Behind a proxy, set `TRUST_PROXY` (see `backend/.env.example`) so the backend sees real client IPs.
- **Timeouts:** calls to Threads give up after 15 s and geocoder calls after 10 s.
- **Location accuracy:** text-based locations are heuristics. A post that only says "Jaksel" lands at the district centre. Each listing shows whether its location came from a tag or from the text.
- **Tuning:** place-reading rules and aliases (Jaksel, Tangsel, …) are in `backend/src/domain/place-extractor.ts`, with examples in its tests.

## API

Every route except `/api/health`, the login routes and Meta's callbacks needs a logged-in session.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | `{"ok":true}` while the backend is up. No login needed |
| GET | `/api/auth/options` | Whether Threads login is available |
| GET | `/api/auth/threads/login` | Start "Log in with Threads" (redirects to Threads) |
| GET | `/api/auth/threads/callback` | Where Threads sends the user back |
| POST | `/api/auth/logout` | Log out (ends the session on the server) |
| GET / DELETE | `/api/me` | The logged-in account / delete everything stored about it |
| GET | `/api/status` | Threads connection, listing counts, last refresh |
| GET | `/api/listings?lat=&lng=&radiusKm=10&kind=all\|sale\|rent&days=30` | `items`: the user's listings ranked by distance. `unlocated`: listings with no location. Missing details are `null` |
| GET | `/api/places?q=` | Address, landmark or `lat,lng` to coordinates |
| POST / GET | `/api/refresh` | Start a refresh (body `{"days":30}`) / its progress |
| POST | `/api/threads/deauthorize` | Meta: the user removed the app (their token is forgotten) |
| POST | `/api/threads/data-deletion` | Meta: the user asked for deletion (everything is deleted) |
| GET | `/api/threads/data-deletion/status?code=` | The status page Meta links the user to |

Errors come back as `{ "error": "<message>" }`. A 401 also includes a `code`:

- `not_signed_in`: log in to the app.
- `threads_login_required`: log in with Threads again.

A `429` means the rate limit was hit; its `Retry-After` header says how many seconds to wait.
