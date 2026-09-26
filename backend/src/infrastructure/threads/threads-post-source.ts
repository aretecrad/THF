import { UpstreamError } from "../../application/errors.js";
import type { PostSearch, PostSource, PostSourceFactory } from "../../application/ports/post-source.js";
import type { Post } from "../../domain/post.js";

type Fetch = typeof fetch;

interface ThreadsMedia {
  readonly id: string;
  readonly text?: string;
  readonly permalink?: string;
  readonly username?: string;
  readonly timestamp?: string;
  readonly is_reply?: boolean;
  readonly has_replies?: boolean;
  readonly location?: { readonly name?: string; readonly city?: string; readonly latitude?: number; readonly longitude?: number };
}

interface ThreadsPage {
  readonly data?: readonly ThreadsMedia[];
  readonly paging?: { readonly next?: string };
  readonly error?: { readonly message?: string };
}

const API = "https://graph.threads.net/v1.0";
const API_ORIGIN = new URL(API).origin;
const BASE_FIELDS = "id,text,permalink,username,timestamp,is_reply,has_replies";
const LOCATION_FIELDS = "location{name,city,latitude,longitude}";
const PAGE_SIZE = 100;
const TIMEOUT_MS = 15_000;

class LocationFieldRejected extends Error {}

export class ThreadsPostSourceFactory implements PostSourceFactory {
  constructor(private readonly http: Fetch = (input, init) => fetch(input, init)) {}

  forAccessToken(accessToken: string): PostSource {
    return new ThreadsPostSource(accessToken, this.http);
  }
}

export class ThreadsPostSource implements PostSource {
  private canReadLocation = true;

  constructor(
    private readonly accessToken: string,
    private readonly http: Fetch = (input, init) => fetch(input, init),
  ) {}

  async search(search: PostSearch): Promise<Post[]> {
    try {
      return await this.fetchPages(this.searchUrl(search), search.maxPages, this.canReadLocation);
    } catch (error) {
      if (!(error instanceof LocationFieldRejected)) throw error;
      this.canReadLocation = false;
      return this.fetchPages(this.searchUrl(search), search.maxPages, false);
    }
  }

  async replies(postId: string, maxPages: number): Promise<Post[]> {
    const params = new URLSearchParams({ fields: BASE_FIELDS, reverse: "false", access_token: this.accessToken });
    return this.fetchPages(`${API}/${encodeURIComponent(postId)}/conversation?${params}`, maxPages, false);
  }

  private searchUrl({ query, mode, order, since }: PostSearch): string {
    const params = new URLSearchParams({
      q: query,
      search_mode: mode,
      search_type: order,
      since: String(Math.floor(since.getTime() / 1000)),
      limit: String(PAGE_SIZE),
      fields: this.canReadLocation ? `${BASE_FIELDS},${LOCATION_FIELDS}` : BASE_FIELDS,
      access_token: this.accessToken,
    });
    return `${API}/keyword_search?${params}`;
  }

  private async fetchPages(firstUrl: string, maxPages: number, askedForLocation: boolean): Promise<Post[]> {
    const posts: Post[] = [];
    let url: string | undefined = firstUrl;
    for (let page = 0; url && page < maxPages; page++) {
      const body = await this.fetchPage(url, askedForLocation);
      posts.push(...(body.data ?? []).map(toPost));
      url = body.paging?.next;
      if (url && new URL(url).origin !== API_ORIGIN) throw new UpstreamError("Threads API: unexpected paging link.");
    }
    return posts;
  }

  private async fetchPage(url: string, askedForLocation: boolean): Promise<ThreadsPage> {
    const response = await this.http(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch((error: unknown) => {
      throw new UpstreamError(`Threads API: ${error instanceof Error ? error.message : String(error)}`);
    });
    const body = (await response.json().catch(() => ({}))) as ThreadsPage;
    if (response.ok && !body.error) return body;

    const message = body.error?.message ?? `HTTP ${response.status}`;
    if (askedForLocation && /location|field/i.test(message)) throw new LocationFieldRejected(message);
    throw new UpstreamError(`Threads API: ${message}`);
  }
}

function toPost(media: ThreadsMedia): Post {
  const { location } = media;
  const hasCoordinates = location?.latitude != null && location.longitude != null;
  return {
    id: media.id,
    text: media.text ?? "",
    author: media.username,
    permalink: media.permalink,
    postedAt: media.timestamp ? new Date(media.timestamp) : undefined,
    isReply: media.is_reply ?? false,
    hasReplies: media.has_replies,
    taggedPlace: hasCoordinates
      ? { point: { lat: location.latitude!, lng: location.longitude! }, name: location.name ?? location.city }
      : undefined,
  };
}
