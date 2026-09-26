import { classifyPost, extractPrice } from "./listing-classifier.js";
import type { DetailSource, ListingKind } from "./listing.js";
import { extractPlaceCandidates } from "./place-extractor.js";
import type { Post } from "./post.js";

export interface PlaceHint {
  readonly name: string;
  readonly source: DetailSource;
}

export interface ListingDraft {
  readonly source: Post;
  readonly kind: ListingKind;
  readonly origin: "post" | "comment";
  readonly price?: { readonly value: string; readonly source: DetailSource };
  readonly placeHints: readonly PlaceHint[];
}

export function draftListings(post: Post, comments: readonly Post[] = []): ListingDraft[] {
  const intent = classifyPost(post.text);
  if (intent.type === "unrelated") return [];

  const drafts: ListingDraft[] = [];
  if (intent.type === "offer") {
    drafts.push(draft(post, intent.kind, post.isReply ? "comment" : "post", commentsBy(comments, post.author)));
  }
  for (const [author, authored] of groupByAuthor(comments)) {
    if (author === post.author) continue;
    for (const [index, comment] of authored.entries()) {
      const commentIntent = classifyPost(comment.text);
      if (commentIntent.type !== "offer") continue;
      drafts.push(draft(comment, commentIntent.kind, "comment", authored.slice(index + 1)));
      break;
    }
  }
  return drafts;
}

export const isMissingDetails = (draft: ListingDraft): boolean =>
  draft.price === undefined || (draft.source.taggedPlace === undefined && draft.placeHints.length === 0);

function draft(source: Post, kind: ListingKind, origin: ListingDraft["origin"], followUps: readonly Post[]): ListingDraft {
  const texts = [
    { text: source.text, source: "text" as const, isAnswer: false },
    ...followUps.map((comment) => ({ text: comment.text, source: "comment" as const, isAnswer: true })),
  ];

  let price: ListingDraft["price"];
  for (const { text, source: from } of texts) {
    const value = extractPrice(text);
    if (value) {
      price = { value, source: from };
      break;
    }
  }

  const hints = new Map<string, PlaceHint>();
  for (const { text, source: from, isAnswer } of texts) {
    for (const name of extractPlaceCandidates(text, { allowBareAnswer: isAnswer })) {
      if (!hints.has(name.toLowerCase())) hints.set(name.toLowerCase(), { name, source: from });
    }
  }
  return { source, kind, origin, price, placeHints: [...hints.values()] };
}

function commentsBy(comments: readonly Post[], author: string | undefined): Post[] {
  return author === undefined ? [] : comments.filter((comment) => comment.author === author);
}

function groupByAuthor(comments: readonly Post[]): Map<string, Post[]> {
  const groups = new Map<string, Post[]>();
  for (const comment of comments) {
    if (comment.author === undefined) continue;
    groups.set(comment.author, [...(groups.get(comment.author) ?? []), comment]);
  }
  return groups;
}
