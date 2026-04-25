import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: { findUnique: mockFindUnique },
  },
}));

import { getCompanyName, getMaxAttachmentSizeMb } from "@/lib/settings";

beforeEach(() => {
  mockFindUnique.mockReset();
});

describe("getCompanyName", () => {
  it("DB 有值應回傳設定值", async () => {
    mockFindUnique.mockResolvedValue({ key: "companyName", value: "企盉科技" });
    expect(await getCompanyName()).toBe("企盉科技");
  });

  it("DB 無值應回傳預設值 'EIP'", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getCompanyName()).toBe("EIP");
  });
});

describe("getMaxAttachmentSizeMb", () => {
  it("DB 有合法數值應回傳該數值", async () => {
    mockFindUnique.mockResolvedValue({ key: "maxAttachmentSizeMb", value: "20" });
    expect(await getMaxAttachmentSizeMb()).toBe(20);
  });

  it("DB 無值應回傳預設值 10", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getMaxAttachmentSizeMb()).toBe(10);
  });

  it("DB 值為非數字應回傳預設值 10", async () => {
    mockFindUnique.mockResolvedValue({ key: "maxAttachmentSizeMb", value: "abc" });
    expect(await getMaxAttachmentSizeMb()).toBe(10);
  });

  it("DB 值為 0 應回傳預設值 10（須大於 0）", async () => {
    mockFindUnique.mockResolvedValue({ key: "maxAttachmentSizeMb", value: "0" });
    expect(await getMaxAttachmentSizeMb()).toBe(10);
  });

  it("DB 值為負數應回傳預設值 10", async () => {
    mockFindUnique.mockResolvedValue({ key: "maxAttachmentSizeMb", value: "-5" });
    expect(await getMaxAttachmentSizeMb()).toBe(10);
  });
});
