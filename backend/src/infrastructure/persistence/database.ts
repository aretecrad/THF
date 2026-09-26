import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT,
  picture_url TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS credentials (
  user_id TEXT PRIMARY KEY,
  sealed_token TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  posted_at TEXT,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);
CREATE INDEX IF NOT EXISTS listings_age ON listings (coalesce(posted_at, fetched_at));
CREATE TABLE IF NOT EXISTS refreshes (
  owner_id TEXT PRIMARY KEY,
  refreshed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deletions (
  confirmation_code TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
`;

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

export function inTransaction<T>(db: Database, work: () => T): T {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
