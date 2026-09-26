export interface StoredSession {
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface SessionStore {
  find(idHash: string): Promise<StoredSession | undefined>;
  save(idHash: string, session: StoredSession): Promise<void>;
  delete(idHash: string): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}
