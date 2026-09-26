import type { ListingKind } from "./listing.js";

const SALE_WORDS = /\b(dijual|jual|for sale|shm|hgb)\b/i;
const RENT_WORDS = /\b(disewakan|sewa|kontrakan|dikontrakkan|for rent|per ?(bulan|tahun|month|year))\b|\/\s?(bln|bulan|thn|th|tahun|mo)\b/i;
const OFFER_WORDS = /\b(di ?jual|di ?sewakan|di ?kontrakkan|for sale|for rent)\b/i;
const WANTED_WORDS = /\b(cari|nyari|mencari|butuh|mau|pengen|rekomendasi|looking for|anyone|wtb|budget|bujet)\b/i;

const PRICE_PATTERNS: readonly RegExp[] = [
  /\brp\.?\s?\d[\d.,]*(\s?(miliar|milyar|juta|jt|rb|m))?\b(\s?\/\s?[a-z]+)?/i,
  /\b\d+([.,]\d+)?\s?(miliar|milyar|juta|jt)\b(\s?\/\s?[a-z]+)?/i,
  /\b\d+([.,]\d+)?\s?M\b/,
  /\$\s?\d[\d,.]*\s?[km]?\b(\s?\/\s?(mo|month|yr|year))?/i,
];

type PostIntent =
  | { readonly type: "offer"; readonly kind: ListingKind }
  | { readonly type: "wanted" }
  | { readonly type: "unrelated" };

export function classifyPost(text: string): PostIntent {
  const forSale = SALE_WORDS.test(text);
  const forRent = RENT_WORDS.test(text);
  if (!forSale && !forRent) return { type: "unrelated" };
  if (!OFFER_WORDS.test(text) && WANTED_WORDS.test(text)) return { type: "wanted" };
  return { type: "offer", kind: forSale && forRent ? "sale/rent" : forSale ? "sale" : "rent" };
}

export function extractPrice(text: string): string | undefined {
  for (const pattern of PRICE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0].trim();
  }
  return undefined;
}
