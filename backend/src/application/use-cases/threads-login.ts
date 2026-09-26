import type { User } from "../../domain/user.js";
import type { AuthProvider } from "../ports/auth-provider.js";
import type { Clock } from "../ports/clock.js";
import type { CredentialStore } from "../ports/credential-store.js";
import type { UserRepository } from "../ports/user-repository.js";

export class ThreadsLogin {
  constructor(
    private readonly auth: AuthProvider,
    private readonly users: UserRepository,
    private readonly credentials: CredentialStore,
    private readonly clock: Clock,
  ) {}

  isAvailable(): boolean {
    return this.auth.isConfigured();
  }

  authorizationUrl(state: string): string {
    return this.auth.authorizationUrl(state);
  }

  async complete(code: string): Promise<User> {
    const credential = await this.auth.exchangeCode(code);
    const profile = await this.auth.profile(credential.accessToken);
    const existing = await this.users.findById(profile.id);

    const user: User = {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
      createdAt: existing?.createdAt ?? this.clock.now(),
    };
    await this.users.save(user);
    await this.credentials.save(user.id, credential);
    return user;
  }
}
