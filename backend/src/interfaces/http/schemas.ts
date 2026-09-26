import type { KindFilter } from "../../domain/listing.js";

export interface ListingsQuery {
  readonly lat?: number;
  readonly lng?: number;
  readonly radiusKm: number;
  readonly kind: KindFilter;
  readonly days: number;
  readonly limit: number;
}

export interface PlacesQuery {
  readonly q: string;
}

export interface RefreshBody {
  readonly days: number;
  readonly pages: number;
}

export const listingsQuerySchema = {
  type: "object",
  properties: {
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 },
    radiusKm: { type: "number", minimum: 0.1, maximum: 500, default: 10 },
    kind: { type: "string", enum: ["all", "sale", "rent"], default: "all" },
    days: { type: "integer", minimum: 1, maximum: 3650, default: 30 },
    limit: { type: "integer", minimum: 1, maximum: 1000, default: 300 },
  },
} as const;

export const placesQuerySchema = {
  type: "object",
  required: ["q"],
  properties: { q: { type: "string", minLength: 2, maxLength: 200 } },
} as const;

export const refreshBodySchema = {
  type: "object",
  properties: {
    days: { type: "integer", minimum: 1, maximum: 365, default: 30 },
    pages: { type: "integer", minimum: 1, maximum: 5, default: 2 },
  },
} as const;
