import type { Listing } from "../../domain/listing.js";

export interface ListingRepository {
  findAll(ownerId: string): Promise<Listing[]>;
  findById(ownerId: string, id: string): Promise<Listing | undefined>;
  saveAll(ownerId: string, listings: readonly Listing[]): Promise<void>;
  lastRefreshedAt(ownerId: string): Promise<Date | undefined>;
  markRefreshed(ownerId: string, at: Date): Promise<void>;
  deleteOwner(ownerId: string): Promise<void>;
  deleteOlderThan(cutoff: Date): Promise<number>;
}
