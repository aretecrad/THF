import { createHmac, timingSafeEqual } from "node:crypto";

export class MetaSignedRequestVerifier {
  constructor(private readonly appSecret: string) {}

  userIdFrom(signedRequest: string): string | null {
    const [encodedSignature, payload] = signedRequest.split(".");
    if (!encodedSignature || !payload || !this.appSecret) return null;

    const expected = createHmac("sha256", this.appSecret).update(payload).digest();
    const actual = Buffer.from(encodedSignature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const json = Buffer.from(payload, "base64url").toString("utf8");
    const userId = /"user_id"\s*:\s*"?(\d+)"?/.exec(json)?.[1];
    return /"algorithm"\s*:\s*"HMAC-SHA256"/i.test(json) && userId ? userId : null;
  }
}
