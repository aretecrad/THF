import type { GeoPoint } from "../../domain/geo-point.js";

export interface Place extends GeoPoint {
  readonly name: string;
}

export interface Geocoder {
  geocode(query: string, options?: { readonly urgent?: boolean }): Promise<Place | null>;
}
