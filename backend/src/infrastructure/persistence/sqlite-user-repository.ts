import type { UserRepository } from "../../application/ports/user-repository.js";
import type { User } from "../../domain/user.js";
import type { Database } from "./database.js";

interface UserRow {
  readonly id: string;
  readonly username: string;
  readonly name: string | null;
  readonly picture_url: string | null;
  readonly created_at: string;
}

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      username: row.username,
      ...(row.name !== null && { name: row.name }),
      ...(row.picture_url !== null && { pictureUrl: row.picture_url }),
      createdAt: new Date(row.created_at),
    };
  }

  async save(user: User): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO users (id, username, name, picture_url, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET username = excluded.username, name = excluded.name, picture_url = excluded.picture_url`,
      )
      .run(user.id, user.username, user.name ?? null, user.pictureUrl ?? null, user.createdAt.toISOString());
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
}
