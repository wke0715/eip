import { describe, it, expect, vi } from "vitest";

// 設定測試用的 ENCRYPTION_KEY（32 bytes hex = 64 chars）
vi.stubEnv(
  "ENCRYPTION_KEY",
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
);

import { encrypt, decrypt } from "@/lib/crypto";

describe("AES-256 加密/解密", () => {
  it("加密後解密應得到原始文字", () => {
    const original = "my-smtp-password-123";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("每次加密結果應不同（因為 IV 隨機）", () => {
    const original = "test-password";
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("加密結果格式應為 iv:authTag:encrypted", () => {
    const encrypted = encrypt("test");
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});
