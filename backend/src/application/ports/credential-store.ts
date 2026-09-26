import type { Credential } from "../../domain/credential.js";

export interface CredentialStore {
  find(userId: string): Promise<Credential | undefined>;
  save(userId: string, credential: Credential): Promise<void>;
  delete(userId: string): Promise<void>;
  all(): Promise<ReadonlyArray<{ readonly userId: string; readonly credential: Credential }>>;
}
