export interface DeletionRecord {
  readonly confirmationCode: string;
  readonly completedAt: Date;
}

export interface DeletionLog {
  record(completedAt: Date): Promise<DeletionRecord>;
  find(confirmationCode: string): Promise<DeletionRecord | undefined>;
}
