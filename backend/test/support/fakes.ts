import type { AuthProvider, ThreadsProfile } from "../../src/application/ports/auth-provider.js";
import { UpstreamError } from "../../src/application/errors.js";
import type { Clock } from "../../src/application/ports/clock.js";
import type { CredentialStore } from "../../src/application/ports/credential-store.js";
import type { DeletionLog, DeletionRecord } from "../../src/application/ports/deletion-log.js";
import type { Geocoder, Place } from "../../src/application/ports/geocoder.js";
import type { PostSearch, PostSource, PostSourceFactory } from "../../src/application/ports/post-source.js";
import type { UserRepository } from "../../src/application/ports/user-repository.js";
import type { Credential } from "../../src/domain/credential.js";
import type { Listing } from "../../src/domain/listing.js";
import type { Post } from "../../src/domain/post.js";
import type { User } from "../../src/domain/user.js";
import { openDatabase } from "../../src/infrastructure/persistence/database.js";
import { SqliteListingRepository } from "../../src/infrastructure/persistence/sqlite-listing-repository.js";

export const DAY = 86_400_000;

export class FixedClock implements Clock {
  constructor(private instant: Date) {}

  now(): Date {
    return new Date(this.instant);
  }

  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }
}

export const memoryDatabase = () => openDatabase(":memory:");

export class InMemoryListingRepository extends SqliteListingRepository {
  private readonly database;

  constructor(initial: Readonly<Record<string, readonly Listing[]>> = {}, database = memoryDatabase()) {
    super(database);
    this.database = database;
    for (const [ownerId, listings] of Object.entries(initial)) void this.saveAll(ownerId, listings);
  }

  hasOwner(ownerId: string): boolean {
    const query = "SELECT 1 FROM listings WHERE owner_id = ? UNION SELECT 1 FROM refreshes WHERE owner_id = ?";
    return this.database.prepare(query).get(ownerId, ownerId) !== undefined;
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  async findById(id: string) {
    return this.users.get(id);
  }

  async save(user: User) {
    this.users.set(user.id, user);
  }

  async delete(id: string) {
    this.users.delete(id);
  }
}

export class InMemoryCredentialStore implements CredentialStore {
  readonly credentials = new Map<string, Credential>();

  async find(userId: string) {
    return this.credentials.get(userId);
  }

  async save(userId: string, credential: Credential) {
    this.credentials.set(userId, credential);
  }

  async delete(userId: string) {
    this.credentials.delete(userId);
  }

  async all() {
    return [...this.credentials].map(([userId, credential]) => ({ userId, credential }));
  }
}

export class InMemoryDeletionLog implements DeletionLog {
  readonly records: DeletionRecord[] = [];

  async record(completedAt: Date) {
    const record = { confirmationCode: `CODE${this.records.length + 1}`, completedAt };
    this.records.push(record);
    return record;
  }

  async find(code: string) {
    return this.records.find((record) => record.confirmationCode === code);
  }
}

export class FakeAuthProvider implements AuthProvider {
  readonly renewed: string[] = [];
  failRenewalFor = new Set<string>();

  constructor(
    private readonly clock: Clock,
    private readonly profiles: Readonly<Record<string, ThreadsProfile>> = { "good-code": { id: "1784140579318721", username: "josua" } },
    private readonly configured = true,
  ) {}

  isConfigured() {
    return this.configured;
  }

  authorizationUrl(state: string) {
    return `https://threads.example/authorize?state=${state}`;
  }

  async exchangeCode(code: string): Promise<Credential> {
    if (!this.profiles[code]) throw new Error("Matching code was not found or was already used");
    return this.credential(`token-for-${code}`);
  }

  async renew(credential: Credential): Promise<Credential> {
    if (this.failRenewalFor.has(credential.accessToken)) throw new Error("Session has expired");
    this.renewed.push(credential.accessToken);
    return this.credential(`${credential.accessToken}+renewed`);
  }

  async profile(accessToken: string): Promise<ThreadsProfile> {
    const code = accessToken.replace("token-for-", "");
    const profile = this.profiles[code];
    if (!profile) throw new Error("Invalid token");
    return profile;
  }

  private credential(accessToken: string): Credential {
    const issuedAt = this.clock.now();
    return { accessToken, issuedAt, expiresAt: new Date(issuedAt.getTime() + 60 * DAY) };
  }
}

export class FakePostSource implements PostSource {
  readonly searches: PostSearch[] = [];
  readonly commentRequests: string[] = [];

  constructor(
    private readonly options: {
      readonly posts?: Readonly<Record<string, readonly Post[]>>;
      readonly comments?: Readonly<Record<string, readonly Post[]>>;
      readonly commentError?: string;
      readonly searchError?: string;
    } = {},
  ) {}

  async search(search: PostSearch) {
    this.searches.push(search);
    if (this.options.searchError) throw new UpstreamError(this.options.searchError);
    return [...(this.options.posts?.[search.query] ?? [])];
  }

  async replies(postId: string) {
    this.commentRequests.push(postId);
    if (this.options.commentError) throw new UpstreamError(this.options.commentError);
    return [...(this.options.comments?.[postId] ?? [])];
  }
}

export class FakePostSourceFactory implements PostSourceFactory {
  readonly tokensUsed: string[] = [];

  constructor(readonly source: FakePostSource = new FakePostSource()) {}

  forAccessToken(accessToken: string) {
    this.tokensUsed.push(accessToken);
    return this.source;
  }
}

export class FakeGeocoder implements Geocoder {
  readonly lookups: string[] = [];

  constructor(private readonly places: Readonly<Record<string, Place>>) {}

  async geocode(query: string) {
    this.lookups.push(query);
    return this.places[query.toLowerCase()] ?? null;
  }
}

export function aPost(overrides: Partial<Post> & Pick<Post, "id" | "text">): Post {
  return { author: "seller", isReply: false, ...overrides };
}

export function aComment(overrides: Partial<Post> & Pick<Post, "id" | "text">): Post {
  return aPost({ isReply: true, ...overrides });
}

export function aListing(overrides: Partial<Listing> & Pick<Listing, "id">): Listing {
  return {
    text: "Dijual rumah",
    kind: "sale",
    origin: "post",
    fetchedAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

export function aCredential(issuedAt: Date, accessToken = "token"): Credential {
  return { accessToken, issuedAt, expiresAt: new Date(issuedAt.getTime() + 60 * DAY) };
}

export const at = (lat: number, lng: number, place?: string) => ({ point: { lat, lng }, place, source: "text" as const });
