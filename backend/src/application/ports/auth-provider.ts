import type { Credential } from "../../domain/credential.js";

export interface ThreadsProfile {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
  readonly pictureUrl?: string;
}

export interface AuthProvider {
  isConfigured(): boolean;
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<Credential>;
  renew(credential: Credential): Promise<Credential>;
  profile(accessToken: string): Promise<ThreadsProfile>;
}
