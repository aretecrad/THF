import type { Clock } from "../ports/clock.js";
import type { CredentialStore } from "../ports/credential-store.js";
import type { DeletionLog, DeletionRecord } from "../ports/deletion-log.js";
import type { ListingRepository } from "../ports/listing-repository.js";
import type { UserRepository } from "../ports/user-repository.js";

export class DeleteUserData {
  constructor(
    private readonly users: UserRepository,
    private readonly credentials: CredentialStore,
    private readonly listings: ListingRepository,
    private readonly deletions: DeletionLog,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<DeletionRecord> {
    await this.listings.deleteOwner(userId);
    await this.credentials.delete(userId);
    await this.users.delete(userId);
    return this.deletions.record(this.clock.now());
  }
}

export class DisconnectThreads {
  constructor(private readonly credentials: CredentialStore) {}

  execute(userId: string): Promise<void> {
    return this.credentials.delete(userId);
  }
}

export class CheckDeletion {
  constructor(private readonly deletions: DeletionLog) {}

  execute(confirmationCode: string): Promise<DeletionRecord | undefined> {
    return this.deletions.find(confirmationCode);
  }
}
