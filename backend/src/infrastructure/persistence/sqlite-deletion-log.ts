import { randomBytes } from "node:crypto";
import type { DeletionLog, DeletionRecord } from "../../application/ports/deletion-log.js";
import type { Database } from "./database.js";

export class SqliteDeletionLog implements DeletionLog {
  constructor(private readonly db: Database) {}

  async record(completedAt: Date): Promise<DeletionRecord> {
    const confirmationCode = randomBytes(8).toString("hex").toUpperCase();
    this.db.prepare("INSERT INTO deletions (confirmation_code, completed_at) VALUES (?, ?)").run(confirmationCode, completedAt.toISOString());
    return { confirmationCode, completedAt };
  }

  async find(confirmationCode: string): Promise<DeletionRecord | undefined> {
    const code = confirmationCode.toUpperCase();
    const row = this.db.prepare("SELECT completed_at FROM deletions WHERE confirmation_code = ?").get(code) as { completed_at: string } | undefined;
    return row && { confirmationCode: code, completedAt: new Date(row.completed_at) };
  }
}
