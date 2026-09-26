import { parseGeoPoint } from "@/domain/geo";
import type { EndPoint } from "@/domain/search";
import type { PlacesGateway } from "./ports";

export async function resolveEndPoint(query: string, places: PlacesGateway): Promise<EndPoint> {
  const text = query.trim();
  const point = parseGeoPoint(text);
  if (point) return { point, label: "Entered coordinates" };

  const place = await places.find(text);
  return { point: place.point, label: shortPlaceName(place.name) };
}

const shortPlaceName = (name: string): string =>
  name
    .split(",")
    .slice(0, 2)
    .map((part) => part.trim())
    .join(", ");
