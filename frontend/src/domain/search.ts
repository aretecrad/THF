import type { GeoPoint } from "./geo";
import type { KindFilter } from "./listing";

export interface EndPoint {
  readonly point: GeoPoint;
  readonly label: string;
}

export interface SearchCriteria {
  readonly endPoint: EndPoint | null;
  readonly radiusKm: number;
  readonly kind: KindFilter;
  readonly days: number;
}

export const RADIUS_LIMITS_KM = { min: 1, max: 50 } as const;
export const LOOKBACK_DAYS: readonly number[] = [7, 30, 90, 365];
export const KIND_FILTERS: readonly KindFilter[] = ["all", "sale", "rent"];

export const DEFAULT_CRITERIA: SearchCriteria = { endPoint: null, radiusKm: 10, kind: "all", days: 30 };
