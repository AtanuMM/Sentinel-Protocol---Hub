import crypto from "crypto";

/**
 * Verifies Meta's X-Hub-Signature-256 header.
 * Header format: "sha256=<hex_hmac>"
 * Computed as: HMAC-SHA256(rawBody, WHATSAPP_APP_SECRET)
 */
export function verifyMetaSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
