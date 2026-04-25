import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getTaipeiDateStr, generateFormNumber } from "@/lib/form-number";

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

// ─── generateFormNumber ───────────────────────────────────────

function makeTx(latest: string | null = null) {
  const findFirst = vi.fn().mockResolvedValue(latest ? { formNumber: latest } : null);
  return {
    leaveRequest: { findFirst },
    expenseReport: { findFirst },
    otherExpenseRequest: { findFirst },
    overtimeRequest: { findFirst },
  };
}

describe("generateFormNumber", () => {
  it("LEAVE 無前一筆應生成 -0001", async () => {
    const tx = makeTx(null);
    const result = await generateFormNumber(tx as never, "LEAVE", "20260425");
    expect(result).toBe("20260425-0001");
  });

  it("LEAVE 有前一筆應遞增流水號", async () => {
    const tx = makeTx("20260425-0003");
    const result = await generateFormNumber(tx as never, "LEAVE", "20260425");
    expect(result).toBe("20260425-0004");
  });

  it("EXPENSE 應帶 EX- 前綴", async () => {
    const tx = makeTx(null);
    const result = await generateFormNumber(tx as never, "EXPENSE", "20260425");
    expect(result).toBe("EX-20260425-0001");
  });

  it("OTHER_EXPENSE 應帶 OE- 前綴", async () => {
    const tx = makeTx(null);
    const result = await generateFormNumber(tx as never, "OTHER_EXPENSE", "20260425");
    expect(result).toBe("OE-20260425-0001");
  });

  it("OVERTIME 應帶 OT- 前綴", async () => {
    const tx = makeTx(null);
    const result = await generateFormNumber(tx as never, "OVERTIME", "20260425");
    expect(result).toBe("OT-20260425-0001");
  });

  it("EXPENSE 有前一筆應遞增", async () => {
    const tx = makeTx("EX-20260425-0009");
    const result = await generateFormNumber(tx as never, "EXPENSE", "20260425");
    expect(result).toBe("EX-20260425-0010");
  });
});
