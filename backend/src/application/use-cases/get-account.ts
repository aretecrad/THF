import { isExpired } from "../../domain/credential.js";
import type { User } from "../../domain/user.js";
import type { Clock } from "../ports/clock.js";
import type { CredentialStore } from "../ports/credential-store.js";
import type { UserRepository } from "../ports/user-repository.js";

export interface Account {
  readonly user: User;
  readonly threadsConnected: boolean;
  readonly threadsExpiresAt?: Date;
}

export class GetAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly credentials: CredentialStore,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<Account | undefined> {
    const user = await this.users.findById(userId);
    if (!user) return undefined;
    const credential = await this.credentials.find(userId);
    const threadsConnected = credential !== undefined && !isExpired(credential, this.clock.now());
    return { user, threadsConnected, threadsExpiresAt: credential?.expiresAt };
  }
}
