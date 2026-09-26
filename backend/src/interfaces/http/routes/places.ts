import type { FastifyPluginAsync } from "fastify";
import type { ResolvePlace } from "../../../application/use-cases/resolve-place.js";
import { presentPlace } from "../presenters.js";
import { rateLimit } from "../rate-limit.js";
import { placesQuerySchema, type PlacesQuery } from "../schemas.js";

const PLACE_LOOKUPS_PER_MINUTE = 20;

export const placesRoutes =
  (resolvePlace: ResolvePlace): FastifyPluginAsync =>
  async (app) => {
    const limit = rateLimit(PLACE_LOOKUPS_PER_MINUTE);
    app.get<{ Querystring: PlacesQuery }>("/places", { schema: { querystring: placesQuerySchema }, onRequest: limit }, async (request) =>
      presentPlace(await resolvePlace.execute(request.query.q)),
    );
  };
