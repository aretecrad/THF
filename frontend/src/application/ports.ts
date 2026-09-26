import type { Account, LoginOptions } from "@/domain/account";
import type { GeoPoint } from "@/domain/geo";
import type { ListingsPage } from "@/domain/listing";
import type { RefreshStatus } from "@/domain/refresh";
import type { SearchCriteria } from "@/domain/search";
import type { SystemStatus } from "@/domain/system";

export interface Place {
  readonly point: GeoPoint;
  readonly name: string;
}

export interface ListingsGateway {
  search(criteria: SearchCriteria): Promise<ListingsPage>;
}

export interface PlacesGateway {
  find(query: string): Promise<Place>;
}

export interface RefreshGateway {
  start(days: number): Promise<RefreshStatus>;
  current(): Promise<RefreshStatus>;
}

export interface SystemGateway {
  status(): Promise<SystemStatus>;
}

export interface LocationProvider {
  current(): Promise<GeoPoint>;
}

export interface AuthGateway {
  options(): Promise<LoginOptions>;
  currentAccount(): Promise<Account | null>;
  readonly threadsLoginUrl: string;
  logout(): Promise<void>;
  deleteMyData(): Promise<{ readonly confirmationCode: string }>;
}
