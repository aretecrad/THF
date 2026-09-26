const DEFAULT_PLACE_ALIASES: Readonly<Record<string, string>> = {
  jaksel: "Jakarta Selatan",
  jakbar: "Jakarta Barat",
  jaktim: "Jakarta Timur",
  jakut: "Jakarta Utara",
  jakpus: "Jakarta Pusat",
  tangsel: "Tangerang Selatan",
  jkt: "Jakarta",
  jogja: "Yogyakarta",
};

const LABELLED = /\b(?:lokasi|lok|alamat|area|daerah|address|location)\s*[:\-–]\s*([^\n]+)/gi;
const STREET = /\b(jl|jln|jalan)\.?\s+([^\n.;!?()#|•]+)/gi;
const AREA = /\b(?:area|daerah|kawasan|wilayah|sekitar)\s+([^\n.;!?()#|•]+)/gi;
const AFTER_OFFER = /\b(?:dijual|disewakan|dikontrakkan|for sale|for rent)[ \t]+(?:rumah[ \t]+|house[ \t]+)?((?:(?!\s(?:di|in|at)\s)[^\n.;!?()#|•])+)/gi;
const PREPOSITION = /\b(di|in|at)\s+((?:(?!\s(?:di|in|at)\s)[^\n.;!?()#|•])+)/gi;

const END_OF_PLACE = /(?:^|\s)(?:harga|hrg|rp|hub|hubungi|wa|cp|dm|call|info|luas|lt|lb|kt|km|kamar|lantai|tingkat|shm|hgb|nego|kpr|dekat|deket|near|cocok|siap|bisa|mulai|cuma|hanya|minat|yang|dan|untuk|buat|dengan|no|with|for|only|price)\b.*$/i;
const FILLER_WORDS = /\b(?:rumah|house|lokasi|mewah|minimalis|murah|baru|cantik|bagus|asri|nyaman|strategis|hook|cluster|daerah|kawasan|area|sekitar|wilayah|the|a|of)\b/gi;
const NOT_A_PLACE = /^(?:jual|sewakan|sewa|kontrak\w*|bawah|atas|sini|situ|mana|dalam|luar|tengah|pinggir|cari|over|bayar|huni|tempati|renov\w*|lelang|pakai|jamin\w*|kasih|beli|kredit|dp|this|my|our|your)\b|^(?:raya|utama|besar|tol)$/i;
const MAX_WORDS = 6;
const MIN_LENGTH = 3;

const startsUppercase = (text: string) => /^[A-Z]/.test(text);

const POLITE_WORDS = /\b(?:kak|ka|kakak|sis|gan|bang|min|mas|mbak|om|pak|bu|ya|yaa|yah|nih|dong|deh|sih|aja)\b/gi;
const NOT_A_PLACE_ANSWER = /^(?:masih|sudah|udah|belum|ready|sold|laku|terjual|iya|ya|oke|ok|siap|bisa|boleh|nego|dm|cek|chat|inbox|wa|makasih|terima|thanks|thank|halo|hai|ada|tidak|nggak|gak|harga|lokasi)\b/i;
const MAX_ANSWER_WORDS = 4;

interface ExtractOptions {
  readonly allowBareAnswer?: boolean;
  readonly aliases?: Readonly<Record<string, string>>;
}

export function extractPlaceCandidates(text: string, { allowBareAnswer = false, aliases = DEFAULT_PLACE_ALIASES }: ExtractOptions = {}): string[] {
  const candidates = new Map<string, string>();
  const remember = (candidate: string) => {
    if (!candidates.has(candidate.toLowerCase())) candidates.set(candidate.toLowerCase(), candidate);
  };
  const add = (raw: string, prefix = "") => {
    const name = cleanPlaceName(raw, aliases);
    if (name.length < MIN_LENGTH || NOT_A_PLACE.test(name)) return;
    remember(prefix + name);
    if (name.includes(",")) remember(prefix + name.split(",")[0].trim());
  };

  for (const [, place] of text.matchAll(LABELLED)) add(place);
  for (const [, keyword, street] of text.matchAll(STREET)) {
    if (keyword.toLowerCase() !== "jalan" || startsUppercase(street)) add(street, "Jalan ");
  }
  for (const [, place] of text.matchAll(AREA)) add(place);
  for (const [, place] of text.matchAll(AFTER_OFFER)) if (startsUppercase(place)) add(place);
  for (const [, preposition, place] of text.matchAll(PREPOSITION)) {
    if (preposition.toLowerCase() === "di" || startsUppercase(place)) add(place);
  }
  if (candidates.size === 0 && allowBareAnswer) {
    const answer = bareAnswer(text, aliases);
    if (answer) remember(answer);
  }
  return [...candidates.values()];
}

function bareAnswer(text: string, aliases: Readonly<Record<string, string>>): string | null {
  const words = text.replace(POLITE_WORDS, " ").replace(/[^\p{L}\p{N}\s,-]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > MAX_ANSWER_WORDS) return null;
  const answer = cleanPlaceName(words.join(" "), aliases);
  if (answer.length < MIN_LENGTH || !startsUppercase(answer) || NOT_A_PLACE_ANSWER.test(answer) || NOT_A_PLACE.test(answer)) return null;
  return answer;
}

function cleanPlaceName(raw: string, aliases: Readonly<Record<string, string>>): string {
  return raw
    .replace(/\p{Extended_Pictographic}|[#@]\S+/gu, " ")
    .replace(/\bjln?\.?\s+/gi, "Jalan ")
    .replace(/\s[—–-]\s.*$/, "")
    .replace(/\.\s.*$/, "")
    .replace(END_OF_PLACE, "")
    .replace(/\s\d{2,}.*$/, "")
    .replace(/\s\d+([.,]\d+)?\s?(jt|juta|m|miliar|milyar|rb|ribu|k)\b.*$/i, "")
    .replace(FILLER_WORDS, " ")
    .replace(POLITE_WORDS, " ")
    .replace(/\b\w+\b/g, (word) => aliases[word.toLowerCase()] ?? word)
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:\-–]+|[\s,.:\-–]+$/g, "")
    .split(" ")
    .slice(0, MAX_WORDS)
    .join(" ");
}
