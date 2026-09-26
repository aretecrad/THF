import { createHmac } from "node:crypto";

export function signedRequest(payload: object | string, secret: string): string {
  const body = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
}
