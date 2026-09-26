import type { SessionStore, StoredSession } from "../../application/ports/session-store.js";
import type { Database } from "./database.js";

export class SqliteSessionStore implements SessionStore {
  constructor(private readonly db: Database) {}

  async find(idHash: string): Promise<StoredSession | undefined> {
    const row = this.db.prepare("SELECT user_id, expires_at FROM sessions WHERE id_hash = ?").get(idHash) as { user_id: string; expires_at: string } | undefined;
    return row && { userId: row.user_id, expiresAt: new Date(row.expires_at) };
  }

  async save(idHash: string, session: StoredSession): Promise<void> {
    this.db.prepare("INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)").run(idHash, session.userId, session.expiresAt.toISOString());
  }

  async delete(idHash: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE id_hash = ?").run(idHash);
  }

  async deleteForUser(userId: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  async deleteExpired(now: Date): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  }
}
