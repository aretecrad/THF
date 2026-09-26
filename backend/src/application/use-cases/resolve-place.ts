import { NotFoundError, ValidationError } from "../../domain/errors.js";
import { parseGeoPoint } from "../../domain/geo-point.js";
import type { Geocoder, Place } from "../ports/geocoder.js";

const MIN_QUERY_LENGTH = 2;

export class ResolvePlace {
  constructor(private readonly geocoder: Geocoder) {}

  async execute(query: string): Promise<Place> {
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) throw new ValidationError(`Type at least ${MIN_QUERY_LENGTH} characters.`);

    const point = parseGeoPoint(text);
    if (point) return { ...point, name: text };

    const place = await this.geocoder.geocode(text, { urgent: true });
    if (!place) throw new NotFoundError(`No place found for "${text}". Try a nearby landmark or lat,lng.`);
    return place;
  }
}
