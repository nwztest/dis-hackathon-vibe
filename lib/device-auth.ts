import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DEVICE_TOKEN_BYTES = 32;
export const DEVICE_TOKEN_PREFIX = "cg_";

export function generateDeviceToken() {
  return `${DEVICE_TOKEN_PREFIX}${randomBytes(DEVICE_TOKEN_BYTES).toString("base64url")}`;
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function matchesDeviceToken(token: string, expectedHash: string) {
  if (!token || !/^[0-9a-f]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashDeviceToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  return token.length > 0 ? token : null;
}
