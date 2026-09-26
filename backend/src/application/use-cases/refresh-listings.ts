import { isExpired } from "../../domain/credential.js";
import { classifyPost } from "../../domain/listing-classifier.js";
import { draftListings, isMissingDetails, type ListingDraft } from "../../domain/listing-drafts.js";
import { hasAllDetails, type Listing, type ListingLocation } from "../../domain/listing.js";
import type { Post } from "../../domain/post.js";
import { daysBefore } from "../../domain/time.js";
import { LoginRequiredError } from "../errors.js";
import type { Clock } from "../ports/clock.js";
import type { CredentialStore } from "../ports/credential-store.js";
import type { Geocoder, Place } from "../ports/geocoder.js";
import type { ListingRepository } from "../ports/listing-repository.js";
import type { PostSource, PostSourceFactory, SearchOrder } from "../ports/post-source.js";
import type { SearchTerm } from "../search-terms.js";

export interface RefreshOptions {
  readonly days: number;
  readonly pagesPerSearch: number;
}

export interface RefreshProgress {
  readonly phase: "searching" | "reading";
  readonly done: number;
  readonly total: number;
}

export interface RefreshSummary {
  readonly postsFound: number;
  readonly added: number;
  readonly located: number;
  readonly commentsRead: number;
  readonly geocodeLimitReached: boolean;
  readonly commentLimitReached: boolean;
  readonly commentsError?: string;
}

export interface RefreshSettings {
  readonly searchTerms: readonly SearchTerm[];
  readonly maxGeocodesPerRun: number;
  readonly placesTriedPerListing: number;
  readonly readComments: boolean;
  readonly maxCommentFetchesPerRun: number;
  readonly commentPagesPerPost: number;
  readonly checkpointEvery: number;
}

type ProgressListener = (progress: RefreshProgress) => void;

const SEARCH_ORDERS: readonly SearchOrder[] = ["RECENT", "TOP"];
const EARLIEST_SEARCHABLE = new Date(1_688_540_400_000);

export class RefreshListings {
  constructor(
    private readonly sources: PostSourceFactory,
    private readonly geocoder: Geocoder,
    private readonly listings: ListingRepository,
    private readonly credentials: CredentialStore,
    private readonly clock: Clock,
    private readonly settings: RefreshSettings,
  ) {}

  async assertCanRun(userId: string): Promise<void> {
    await this.sourceFor(userId);
  }

  async execute(userId: string, options: RefreshOptions, onProgress: ProgressListener = () => {}): Promise<RefreshSummary> {
    const source = await this.sourceFor(userId);
    const posts = await this.collectPosts(source, options, onProgress);
    const run = new RunState(userId, source, this.settings);

    for (const [index, post] of posts.entries()) {
      onProgress({ phase: "reading", done: index, total: posts.length });
      await this.processPost(post, run);
      if (run.pending.length >= this.settings.checkpointEvery) await this.listings.saveAll(userId, run.pending.splice(0));
    }
    await this.listings.saveAll(userId, run.pending);
    await this.listings.markRefreshed(userId, this.clock.now());
    onProgress({ phase: "reading", done: posts.length, total: posts.length });
    return run.summary(posts.length);
  }

  private async sourceFor(userId: string): Promise<PostSource> {
    const credential = await this.credentials.find(userId);
    if (!credential || isExpired(credential, this.clock.now())) {
      throw new LoginRequiredError("Log in with Threads to refresh listings.");
    }
    return this.sources.forAccessToken(credential.accessToken);
  }

  private async collectPosts(source: PostSource, { days, pagesPerSearch }: RefreshOptions, onProgress: ProgressListener): Promise<Post[]> {
    const since = new Date(Math.max(EARLIEST_SEARCHABLE.getTime(), daysBefore(this.clock.now(), days).getTime()));
    const searches = this.settings.searchTerms.flatMap((term) => SEARCH_ORDERS.map((order) => ({ ...term, order })));
    const posts = new Map<string, Post>();

    for (const [index, { query, mode, order }] of searches.entries()) {
      onProgress({ phase: "searching", done: index, total: searches.length });
      for (const post of await source.search({ query, mode, order, since, maxPages: pagesPerSearch })) {
        posts.set(post.id, post);
      }
    }
    onProgress({ phase: "searching", done: searches.length, total: searches.length });
    return [...posts.values()];
  }

  private async processPost(post: Post, run: RunState): Promise<void> {
    const existing = await this.listings.findById(run.userId, post.id);
    if (existing && hasAllDetails(existing)) return;

    for (const draft of await this.draftsFor(post, run)) {
      const previous = draft.source.id === post.id ? existing : await this.listings.findById(run.userId, draft.source.id);
      if (previous && hasAllDetails(previous)) continue;

      const listing = await this.toListing(draft, previous, run);
      run.pending.push(listing);
      if (!previous) run.added++;
      if (listing.location) run.located++;
    }
  }

  private async draftsFor(post: Post, run: RunState): Promise<ListingDraft[]> {
    const fromPostAlone = draftListings(post);
    if (!this.shouldReadComments(post, fromPostAlone, run)) return fromPostAlone;
    const comments = await this.readComments(post, run);
    return comments.length > 0 ? draftListings(post, comments) : fromPostAlone;
  }

  private shouldReadComments(post: Post, drafts: readonly ListingDraft[], run: RunState): boolean {
    if (!this.settings.readComments || run.commentsError !== undefined) return false;
    if (post.isReply || post.hasReplies === false) return false;
    return classifyPost(post.text).type === "wanted" || drafts.some(isMissingDetails);
  }

  private async readComments(post: Post, run: RunState): Promise<Post[]> {
    if (!run.commentFetches.take()) return [];
    try {
      const comments = await run.source.replies(post.id, this.settings.commentPagesPerPost);
      run.commentsRead++;
      return comments;
    } catch (error) {
      run.commentsError = error instanceof Error ? error.message : String(error);
      return [];
    }
  }

  private async toListing(draft: ListingDraft, previous: Listing | undefined, run: RunState): Promise<Listing> {
    const { source } = draft;
    return {
      id: source.id,
      text: source.text,
      kind: draft.kind,
      origin: draft.origin,
      price: draft.price?.value ?? previous?.price,
      priceSource: draft.price?.source ?? previous?.priceSource,
      permalink: source.permalink,
      author: source.author,
      postedAt: source.postedAt,
      fetchedAt: this.clock.now(),
      location: previous?.location ?? (await this.locate(draft, run)),
    };
  }

  private async locate(draft: ListingDraft, run: RunState): Promise<ListingLocation | undefined> {
    const tag = draft.source.taggedPlace;
    if (tag) return { point: tag.point, place: tag.name, source: "tag" };

    for (const hint of draft.placeHints.slice(0, this.settings.placesTriedPerListing)) {
      const place = await this.lookUp(hint.name, run);
      if (place) return { point: { lat: place.lat, lng: place.lng }, place: hint.name, source: hint.source };
    }
    return undefined;
  }

  private async lookUp(query: string, run: RunState): Promise<Place | null> {
    return run.geocodes.take() ? this.geocoder.geocode(query) : null;
  }
}

class Budget {
  private used = 0;
  exhausted = false;

  constructor(private readonly limit: number) {}

  take(): boolean {
    if (this.used >= this.limit) {
      this.exhausted = true;
      return false;
    }
    this.used++;
    return true;
  }
}

class RunState {
  readonly geocodes: Budget;
  readonly commentFetches: Budget;
  readonly pending: Listing[] = [];
  added = 0;
  located = 0;
  commentsRead = 0;
  commentsError?: string;

  constructor(
    readonly userId: string,
    readonly source: PostSource,
    settings: RefreshSettings,
  ) {
    this.geocodes = new Budget(settings.maxGeocodesPerRun);
    this.commentFetches = new Budget(settings.maxCommentFetchesPerRun);
  }

  summary(postsFound: number): RefreshSummary {
    return {
      postsFound,
      added: this.added,
      located: this.located,
      commentsRead: this.commentsRead,
      geocodeLimitReached: this.geocodes.exhausted,
      commentLimitReached: this.commentFetches.exhausted,
      commentsError: this.commentsError,
    };
  }
}
