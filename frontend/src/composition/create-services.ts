import { BrowserLocationProvider } from "@/infrastructure/browser/browser-location-provider";
import { ApiClient } from "@/infrastructure/http/api-client";
import { HttpAuthGateway, HttpListingsGateway, HttpPlacesGateway, HttpRefreshGateway, HttpSystemGateway } from "@/infrastructure/http/gateways";
import type { Services } from "@/presentation/services";

const API_BASE_URL = "/api";

export function createServices(): Services {
  const api = new ApiClient(API_BASE_URL);
  return {
    auth: new HttpAuthGateway(api, API_BASE_URL),
    listings: new HttpListingsGateway(api),
    places: new HttpPlacesGateway(api),
    refresh: new HttpRefreshGateway(api),
    system: new HttpSystemGateway(api),
    location: new BrowserLocationProvider(),
  };
}
