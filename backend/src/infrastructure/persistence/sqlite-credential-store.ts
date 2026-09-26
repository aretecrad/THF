import type { CredentialStore } from "../../application/ports/credential-store.js";
import type { Credential } from "../../domain/credential.js";
import type { TokenCipher } from "../security/token-cipher.js";
import type { Database } from "./database.js";

interface CredentialRow {
  readonly user_id: string;
  readonly sealed_token: string;
  readonly issued_at: string;
  readonly expires_at: string;
}

export class SqliteCredentialStore implements CredentialStore {
  constructor(
    private readonly db: Database,
    private readonly cipher: TokenCipher,
  ) {}

  async find(userId: string): Promise<Credential | undefined> {
    const row = this.db.prepare("SELECT * FROM credentials WHERE user_id = ?").get(userId) as CredentialRow | undefined;
    return row && this.open(row);
  }

  async save(userId: string, credential: Credential): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO credentials (user_id, sealed_token, issued_at, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET sealed_token = excluded.sealed_token, issued_at = excluded.issued_at, expires_at = excluded.expires_at`,
      )
      .run(userId, this.cipher.encrypt(credential.accessToken), credential.issuedAt.toISOString(), credential.expiresAt.toISOString());
  }

  async delete(userId: string): Promise<void> {
    this.db.prepare("DELETE FROM credentials WHERE user_id = ?").run(userId);
  }

  async all(): Promise<Array<{ userId: string; credential: Credential }>> {
    const rows = this.db.prepare("SELECT * FROM credentials").all() as unknown as CredentialRow[];
    return rows.flatMap((row) => {
      const credential = this.open(row);
      return credential ? [{ userId: row.user_id, credential }] : [];
    });
  }

  private open(row: CredentialRow): Credential | undefined {
    try {
      return { accessToken: this.cipher.decrypt(row.sealed_token), issuedAt: new Date(row.issued_at), expiresAt: new Date(row.expires_at) };
    } catch {
      return undefined;
    }
  }
}
