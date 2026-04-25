import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getTaipeiDateStr } from "@/lib/form-number";

describe("getTaipeiDateStr", () => {
  it("應回傳 YYYYMMDD 格式（無分隔符）", () => {
    const result = getTaipeiDateStr(new Date("2026-04-25T00:00:00Z"));
    expect(result).toMatch(/^\d{8}$/);
  });

  it("UTC 16:00 的前一天應轉換為台北時間當天（+8h）", () => {
    // UTC 2026-04-24T16:00:00Z = 台北 2026-04-25T00:00:00
    const d = new Date("2026-04-24T16:00:00Z");
    expect(getTaipeiDateStr(d)).toBe("20260425");
  });

  it("UTC 07:59 應仍是台北前一天", () => {
    // UTC 2026-04-24T07:59:00Z = 台北 2026-04-24T15:59:00 → 20260424
    const d = new Date("2026-04-24T07:59:00Z");
    expect(getTaipeiDateStr(d)).toBe("20260424");
  });

  it("無參數應回傳今天的台北日期字串", () => {
    const result = getTaipeiDateStr();
    expect(result).toMatch(/^\d{8}$/);
  });
});
