import type { SearchMode } from "./ports/post-source.js";

export interface SearchTerm {
  readonly query: string;
  readonly mode: SearchMode;
}

const KEYWORDS = [
  "rumah dijual", "dijual rumah", "jual rumah", "house for sale",
  "rumah disewakan", "disewakan rumah", "sewa rumah", "kontrakan", "house for rent",
];
const TOPIC_TAGS = ["Properti", "Rumah Dijual"];

export const DEFAULT_SEARCH_TERMS: readonly SearchTerm[] = [
  ...KEYWORDS.map((query) => ({ query, mode: "KEYWORD" as const })),
  ...TOPIC_TAGS.map((query) => ({ query, mode: "TAG" as const })),
];
