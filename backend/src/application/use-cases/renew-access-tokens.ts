import { isDueForRenewal } from "../../domain/credential.js";
import type { AuthProvider } from "../ports/auth-provider.js";
import type { Clock } from "../ports/clock.js";
import type { CredentialStore } from "../ports/credential-store.js";

interface RenewalSummary {
  readonly renewed: number;
  readonly failed: ReadonlyArray<{ readonly userId: string; readonly reason: string }>;
}

export class RenewAccessTokens {
  constructor(
    private readonly auth: AuthProvider,
    private readonly credentials: CredentialStore,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<RenewalSummary> {
    const now = this.clock.now();
    let renewed = 0;
    const failed: Array<{ userId: string; reason: string }> = [];

    for (const { userId, credential } of await this.credentials.all()) {
      if (!isDueForRenewal(credential, now)) continue;
      try {
        await this.credentials.save(userId, await this.auth.renew(credential));
        renewed++;
      } catch (error) {
        failed.push({ userId, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return { renewed, failed };
  }
}
