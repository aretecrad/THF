import type { GeoPoint } from "./geo-point.js";

export interface Post {
  readonly id: string;
  readonly text: string;
  readonly author?: string;
  readonly permalink?: string;
  readonly postedAt?: Date;
  readonly isReply: boolean;
  readonly hasReplies?: boolean;
  readonly taggedPlace?: { readonly point: GeoPoint; readonly name?: string };
}
