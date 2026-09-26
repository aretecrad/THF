import type { FastifyPluginAsync } from "fastify";
import type { SearchNearbyListings } from "../../../application/use-cases/search-nearby-listings.js";
import { ValidationError } from "../../../domain/errors.js";
import { createGeoPoint } from "../../../domain/geo-point.js";
import { presentListings } from "../presenters.js";
import { currentUserId } from "../session.js";
import { listingsQuerySchema, type ListingsQuery } from "../schemas.js";

export const listingsRoutes =
  (searchNearby: SearchNearbyListings): FastifyPluginAsync =>
  async (app) => {
    app.get<{ Querystring: ListingsQuery }>("/listings", { schema: { querystring: listingsQuerySchema } }, async (request) => {
      const { lat, lng, radiusKm, kind, days, limit } = request.query;
      if ((lat === undefined) !== (lng === undefined)) throw new ValidationError("Send both lat and lng, or neither.");
      const center = lat !== undefined && lng !== undefined ? createGeoPoint(lat, lng) : undefined;
      return presentListings(await searchNearby.execute(currentUserId(request), { center, radiusKm, kind, days, limit }));
    });
  };
