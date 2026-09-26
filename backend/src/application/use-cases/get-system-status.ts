import { isExpired } from "../../domain/credential.js";
import { isLocated } from "../../domain/listing.js";
import type { Clock } from "../ports/clock.js";
import type { CredentialStore } from "../ports/credential-store.js";
import type { ListingRepository } from "../ports/listing-repository.js";

export interface SystemStatus {
  readonly threadsConnected: boolean;
  readonly listings: number;
  readonly located: number;
  readonly lastRefreshedAt?: Date;
}

export class GetSystemStatus {
  constructor(
    private readonly listings: ListingRepository,
    private readonly credentials: CredentialStore,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<SystemStatus> {
    const all = await this.listings.findAll(userId);
    const credential = await this.credentials.find(userId);
    return {
      threadsConnected: credential !== undefined && !isExpired(credential, this.clock.now()),
      listings: all.length,
      located: all.filter(isLocated).length,
      lastRefreshedAt: await this.listings.lastRefreshedAt(userId),
    };
  }
}
