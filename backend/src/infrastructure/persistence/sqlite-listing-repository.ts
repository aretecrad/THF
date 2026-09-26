import type { ListingRepository } from "../../application/ports/listing-repository.js";
import type { Listing } from "../../domain/listing.js";
import { inTransaction, type Database } from "./database.js";

export class SqliteListingRepository implements ListingRepository {
  constructor(private readonly db: Database) {}

  async findAll(ownerId: string): Promise<Listing[]> {
    const rows = this.db.prepare("SELECT data FROM listings WHERE owner_id = ? ORDER BY rowid").all(ownerId) as unknown as Array<{ data: string }>;
    return rows.map(({ data }) => fromJson(data));
  }

  async findById(ownerId: string, id: string): Promise<Listing | undefined> {
    const row = this.db.prepare("SELECT data FROM listings WHERE owner_id = ? AND id = ?").get(ownerId, id) as { data: string } | undefined;
    return row && fromJson(row.data);
  }

  async saveAll(ownerId: string, listings: readonly Listing[]): Promise<void> {
    const upsert = this.db.prepare(
      `INSERT INTO listings (owner_id, id, data, posted_at, fetched_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (owner_id, id) DO UPDATE SET data = excluded.data, posted_at = excluded.posted_at, fetched_at = excluded.fetched_at`,
    );
    inTransaction(this.db, () => {
      for (const listing of listings) {
        upsert.run(ownerId, listing.id, JSON.stringify(listing), listing.postedAt?.toISOString() ?? null, listing.fetchedAt.toISOString());
      }
    });
  }

  async lastRefreshedAt(ownerId: string): Promise<Date | undefined> {
    const row = this.db.prepare("SELECT refreshed_at FROM refreshes WHERE owner_id = ?").get(ownerId) as { refreshed_at: string } | undefined;
    return row && new Date(row.refreshed_at);
  }

  async markRefreshed(ownerId: string, at: Date): Promise<void> {
    this.db
      .prepare("INSERT INTO refreshes (owner_id, refreshed_at) VALUES (?, ?) ON CONFLICT (owner_id) DO UPDATE SET refreshed_at = excluded.refreshed_at")
      .run(ownerId, at.toISOString());
  }

  async deleteOwner(ownerId: string): Promise<void> {
    inTransaction(this.db, () => {
      this.db.prepare("DELETE FROM listings WHERE owner_id = ?").run(ownerId);
      this.db.prepare("DELETE FROM refreshes WHERE owner_id = ?").run(ownerId);
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    return Number(this.db.prepare("DELETE FROM listings WHERE coalesce(posted_at, fetched_at) < ?").run(cutoff.toISOString()).changes);
  }
}

function fromJson(data: string): Listing {
  const { postedAt, fetchedAt, ...rest } = JSON.parse(data) as Omit<Listing, "postedAt" | "fetchedAt"> & { postedAt?: string; fetchedAt: string };
  return { ...rest, ...(postedAt !== undefined && { postedAt: new Date(postedAt) }), fetchedAt: new Date(fetchedAt) };
}
