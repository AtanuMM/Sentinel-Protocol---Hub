import { describe, expect, it } from "vitest";
import { decryptText, encryptText, hmacSha256 } from "../src/utils/crypto";

describe("crypto utils", () => {
  it("encrypts and decrypts text", () => {
    const encrypted = encryptText("super-secret");
    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe("super-secret");
  });

  it("creates deterministic hmac signatures", () => {
    const first = hmacSha256("payload", "secret");
    const second = hmacSha256("payload", "secret");
    expect(first).toBe(second);
  });
});
