import { DAY_MS } from "./time.js";

export interface Credential {
  readonly accessToken: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

const MIN_AGE_TO_RENEW_MS = DAY_MS;
const RENEW_AFTER_MS = 7 * DAY_MS;

export const isExpired = (credential: Credential, now: Date): boolean => credential.expiresAt <= now;

export function isDueForRenewal(credential: Credential, now: Date): boolean {
  const age = now.getTime() - credential.issuedAt.getTime();
  return !isExpired(credential, now) && age >= Math.max(MIN_AGE_TO_RENEW_MS, RENEW_AFTER_MS);
}
