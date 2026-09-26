import { NotSignedInError } from "@/application/errors";
import type { AuthGateway, ListingsGateway, Place, PlacesGateway, RefreshGateway, SystemGateway } from "@/application/ports";
import type { Account, LoginOptions } from "@/domain/account";
import type { ListingsPage } from "@/domain/listing";
import type { RefreshStatus } from "@/domain/refresh";
import type { SearchCriteria } from "@/domain/search";
import type { SystemStatus } from "@/domain/system";
import type { ApiClient } from "./api-client";
import type { AccountDto, ListingsDto, LoginOptionsDto, PlaceDto, RefreshStatusDto, SystemStatusDto } from "./dto";
import { toListingsPage, toPlace, toRefreshStatus, toSystemStatus } from "./mappers";

export class HttpListingsGateway implements ListingsGateway {
  constructor(private readonly api: ApiClient) {}

  async search({ endPoint, radiusKm, kind, days }: SearchCriteria): Promise<ListingsPage> {
    const query = { lat: endPoint?.point.lat, lng: endPoint?.point.lng, radiusKm, kind, days };
    return toListingsPage(await this.api.get<ListingsDto>("/listings", query));
  }
}

export class HttpPlacesGateway implements PlacesGateway {
  constructor(private readonly api: ApiClient) {}

  async find(query: string): Promise<Place> {
    return toPlace(await this.api.get<PlaceDto>("/places", { q: query }));
  }
}

export class HttpRefreshGateway implements RefreshGateway {
  constructor(private readonly api: ApiClient) {}

  async start(days: number): Promise<RefreshStatus> {
    return toRefreshStatus(await this.api.post<RefreshStatusDto>("/refresh", { days }));
  }

  async current(): Promise<RefreshStatus> {
    return toRefreshStatus(await this.api.get<RefreshStatusDto>("/refresh"));
  }
}

export class HttpSystemGateway implements SystemGateway {
  constructor(private readonly api: ApiClient) {}

  async status(): Promise<SystemStatus> {
    return toSystemStatus(await this.api.get<SystemStatusDto>("/status"));
  }
}

export class HttpAuthGateway implements AuthGateway {
  readonly threadsLoginUrl: string;

  constructor(
    private readonly api: ApiClient,
    apiBaseUrl: string,
  ) {
    this.threadsLoginUrl = `${apiBaseUrl}/auth/threads/login`;
  }

  async options(): Promise<LoginOptions> {
    const { threadsLogin } = await this.api.get<LoginOptionsDto>("/auth/options");
    return { threads: threadsLogin };
  }

  async currentAccount(): Promise<Account | null> {
    try {
      const { id, username, name, pictureUrl, threadsConnected } = await this.api.get<AccountDto>("/me");
      return { id, username, name, pictureUrl, threadsConnected };
    } catch (error) {
      if (error instanceof NotSignedInError) return null;
      throw error;
    }
  }

  async logout(): Promise<void> {
    await this.api.post("/auth/logout");
  }

  deleteMyData(): Promise<{ confirmationCode: string }> {
    return this.api.delete<{ confirmationCode: string }>("/me");
  }
}
