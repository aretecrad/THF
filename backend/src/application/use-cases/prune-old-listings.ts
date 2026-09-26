import { daysBefore } from "../../domain/time.js";
import type { Clock } from "../ports/clock.js";
import type { ListingRepository } from "../ports/listing-repository.js";

export class PruneOldListings {
  constructor(
    private readonly listings: ListingRepository,
    private readonly clock: Clock,
    private readonly retentionDays: number,
  ) {}

  execute(): Promise<number> {
    return this.listings.deleteOlderThan(daysBefore(this.clock.now(), this.retentionDays));
  }
}
