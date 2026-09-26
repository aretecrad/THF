export interface Account {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
  readonly pictureUrl?: string;
  readonly threadsConnected: boolean;
}

export interface LoginOptions {
  readonly threads: boolean;
}

export type LoginError = "unavailable" | "denied" | "expired" | "failed";

const LOGIN_ERRORS: readonly LoginError[] = ["unavailable", "denied", "expired", "failed"];

export const parseLoginError = (value: string | null): LoginError | null =>
  LOGIN_ERRORS.includes(value as LoginError) ? (value as LoginError) : null;
