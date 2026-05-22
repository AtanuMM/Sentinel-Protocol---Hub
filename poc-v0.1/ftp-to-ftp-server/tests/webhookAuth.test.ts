import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../src/middleware/webhookAuth";
import { hmacSha256 } from "../src/utils/crypto";

describe("webhook signature verification", () => {
  it("passes with valid signature", () => {
    const body = { foo: "bar" };
    const signature = hmacSha256(JSON.stringify(body), process.env.WEBHOOK_SECRET ?? "");
    const request = {
      headers: { "x-webhook-signature": signature },
      body,
    } as any;

    expect(() => verifyWebhookSignature(request)).not.toThrow();
  });
});
