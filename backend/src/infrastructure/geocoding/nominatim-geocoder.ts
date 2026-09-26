import { UpstreamError } from "../../application/errors.js";
import type { Geocoder, Place } from "../../application/ports/geocoder.js";
import type { GeoPoint } from "../../domain/geo-point.js";
import { MinIntervalQueue } from "./min-interval-queue.js";

type Fetch = typeof fetch;

interface NominatimOptions {
  readonly countryCode?: string;
  readonly bias?: GeoPoint;
  readonly contactEmail?: string;
}

interface NominatimResult {
  readonly lat: string;
  readonly lon: string;
  readonly display_name: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1_100;
const BIAS_BOX_DEGREES = 0.5;
const TIMEOUT_MS = 10_000;
const CACHE_SIZE = 5_000;

export class NominatimGeocoder implements Geocoder {
  private readonly queue = new MinIntervalQueue(MIN_INTERVAL_MS);
  private readonly cache = new Map<string, Place | null>();

  constructor(
    private readonly options: NominatimOptions,
    private readonly http: Fetch = (input, init) => fetch(input, init),
  ) {}

  geocode(query: string, { urgent = false } = {}): Promise<Place | null> {
    const key = query.trim().toLowerCase();
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key)!);

    return this.queue.run(() => this.request(query), { urgent }).then((place) => {
      this.cache.set(key, place);
      if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
      return place;
    });
  }

  private async request(query: string): Promise<Place | null> {
    const response = await this.http(`${ENDPOINT}?${this.searchParams(query)}`, {
      headers: { "User-Agent": `threads-house-finder/1.0 (${this.options.contactEmail ?? "no contact set"})` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((error: unknown) => {
      throw new UpstreamError(`Geocoder: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (!response.ok) throw new UpstreamError(`Geocoder answered HTTP ${response.status}`);
    const [best] = (await response.json()) as NominatimResult[];
    return best ? { lat: Number(best.lat), lng: Number(best.lon), name: best.display_name } : null;
  }

  private searchParams(query: string): URLSearchParams {
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1" });
    const { countryCode, bias } = this.options;
    if (countryCode) params.set("countrycodes", countryCode);
    if (bias) {
      const box = [bias.lng - BIAS_BOX_DEGREES, bias.lat + BIAS_BOX_DEGREES, bias.lng + BIAS_BOX_DEGREES, bias.lat - BIAS_BOX_DEGREES];
      params.set("viewbox", box.join(","));
    }
    return params;
  }
}
