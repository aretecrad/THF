import type { Post } from "../../domain/post.js";

export type SearchMode = "KEYWORD" | "TAG";
export type SearchOrder = "RECENT" | "TOP";

export interface PostSearch {
  readonly query: string;
  readonly mode: SearchMode;
  readonly order: SearchOrder;
  readonly since: Date;
  readonly maxPages: number;
}

export interface PostSource {
  search(search: PostSearch): Promise<Post[]>;
  replies(postId: string, maxPages: number): Promise<Post[]>;
}

export interface PostSourceFactory {
  forAccessToken(accessToken: string): PostSource;
}
