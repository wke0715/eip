import { describe, it, expect } from "vitest";
import {
  calcExpenseItemSubtotal,
  createExpenseReportSchema,
  type ExpenseItemInput,
} from "@/lib/validators/expense";
import { buildExpenseWorkbook } from "@/lib/excel/expense-exporter";
import { parseExpenseOnly } from "@/lib/excel/expense-parser";

function sampleItem(override: Partial<ExpenseItemInput> = {}): ExpenseItemInput {
  return {
    date: "2026-04-15",
    days: 1,
    workCategory: "C",
    workDetail: "客戶_ABC 台北→台中",
    mileageSubsidy: 120,
    parkingFee: 50,
    etcFee: 30,
    gasFee: 0,
    transportType: "T",
    transportAmount: 200,
    mealType: "B",
    mealAmount: 100,
    otherKind: null,
    otherName: null,
    otherAmount: 0,
    subtotal: 0,
    receipts: 3,
    remark: null,
    ...override,
  };
}

describe("calcExpenseItemSubtotal", () => {
  it("應加總所有費用欄位", () => {
    const it = sampleItem();
    // 120 + 50 + 30 + 0 + 200 + 100 + 0 = 500
    expect(calcExpenseItemSubtotal(it)).toBe(500);
  });

  it("空值應視為 0", () => {
    const it = sampleItem({
      mileageSubsidy: 0,
      parkingFee: 0,
      etcFee: 0,
      gasFee: 0,
      transportAmount: 0,
      mealAmount: 0,
      otherAmount: 0,
    });
    expect(calcExpenseItemSubtotal(it)).toBe(0);
  });
});

describe("createExpenseReportSchema", () => {
  it("交通費 > 0 必須有 transportType", () => {
    const result = createExpenseReportSchema.safeParse({
      year: 2026,
      month: 4,
      items: [sampleItem({ transportType: null, transportAmount: 300 })],
    });
    expect(result.success).toBe(false);
  });

  it("膳食費 > 0 必須有 mealType", () => {
    const result = createExpenseReportSchema.safeParse({
      year: 2026,
      month: 4,
      items: [sampleItem({ mealType: null, mealAmount: 150 })],
    });
    expect(result.success).toBe(false);
  });

  it("合法表單應通過驗證", () => {
    const result = createExpenseReportSchema.safeParse({
      year: 2026,
      month: 4,
      items: [sampleItem()],
    });
    expect(result.success).toBe(true);
  });

  it("至少要有一筆明細", () => {
    const result = createExpenseReportSchema.safeParse({
      year: 2026,
      month: 4,
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("expense excel 匯出 → 匯入 round-trip", () => {
  it("匯出後解析應還原主要欄位", () => {
    const items: ExpenseItemInput[] = [
      sampleItem({ date: "2026-04-10", subtotal: 500 }),
      sampleItem({
        date: "2026-04-12",
        workDetail: "出差_S 新北→高雄",
        mileageSubsidy: 0,
        parkingFee: 0,
        etcFee: 0,
        gasFee: 500,
        transportType: "A",
        transportAmount: 3500,
        mealType: "A",
        mealAmount: 600,
        otherKind: "H",
        otherAmount: 1800,
        subtotal: 6400,
        receipts: 5,
      }),
    ];

    const buf = buildExpenseWorkbook({
      formNumber: "EX-20260417-0001",
      applicantName: "佑霖",
      year: 2026,
      month: 4,
      totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
      totalReceipts: items.reduce((s, i) => s + i.receipts, 0),
      items,
    });

    const parsed = parseExpenseOnly(buf);
    expect(parsed.items.length).toBe(2);

    // 第一列
    expect(parsed.items[0].date).toBe("2026-04-10");
    expect(parsed.items[0].transportType).toBe("T");
    expect(parsed.items[0].transportAmount).toBe(200);

    // 第二列
    expect(parsed.items[1].date).toBe("2026-04-12");
    expect(parsed.items[1].transportType).toBe("A");
    expect(parsed.items[1].mealType).toBe("A");
    expect(parsed.items[1].otherKind).toBe("H");
    expect(parsed.items[1].subtotal).toBe(6400);
  });

  it("匯出空明細應仍可解析", () => {
    const buf = buildExpenseWorkbook({
      formNumber: "EX-20260417-0002",
      applicantName: "Tester",
      year: 2026,
      month: 4,
      totalAmount: 0,
      totalReceipts: 0,
      items: [],
    });
    const parsed = parseExpenseOnly(buf);
    expect(parsed.items.length).toBe(0);
    expect(parsed.errors.length).toBe(0);
  });
});
