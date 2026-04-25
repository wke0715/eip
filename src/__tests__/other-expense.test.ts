import { describe, it, expect } from "vitest";
import {
  calcOtherExpenseSubtotal,
  createOtherExpenseRequestSchema,
} from "@/lib/validators/otherExpense";

describe("calcOtherExpenseSubtotal", () => {
  it("數量 × 單價應等於小計", () => {
    expect(calcOtherExpenseSubtotal({ quantity: 3, unitPrice: 150 })).toBe(450);
  });

  it("數量為 1 時應等於單價", () => {
    expect(calcOtherExpenseSubtotal({ quantity: 1, unitPrice: 200 })).toBe(200);
  });

  it("單價為 0 時應回傳 0", () => {
    expect(calcOtherExpenseSubtotal({ quantity: 5, unitPrice: 0 })).toBe(0);
  });
});

describe("createOtherExpenseRequestSchema", () => {
  const validItem = {
    date: "2026-04-25",
    itemName: "辦公用紙",
    purpose: "日常辦公使用",
    quantity: 2,
    unitPrice: 150,
    subtotal: 300,
  };

  it("合法表單應通過驗證", () => {
    const result = createOtherExpenseRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it("品名為空應失敗", () => {
    const result = createOtherExpenseRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [{ ...validItem, itemName: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("數量為 0 應失敗（須大於 0）", () => {
    const result = createOtherExpenseRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [{ ...validItem, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("單價為負數應失敗", () => {
    const result = createOtherExpenseRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [{ ...validItem, unitPrice: -10 }],
    });
    expect(result.success).toBe(false);
  });

  it("無明細應失敗", () => {
    const result = createOtherExpenseRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [],
    });
    expect(result.success).toBe(false);
  });
});
