import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  calcExpenseItemSubtotal,
  createExpenseReportSchema,
  type ExpenseItemInput,
} from "@/lib/validators/expense";
import { buildExpenseWorkbook } from "@/lib/excel/expense-exporter";
import { buildOtherExpenseWorkbook } from "@/lib/excel/other-expense-exporter";
import { buildOvertimeWorkbook } from "@/lib/excel/overtime-exporter";
import {
  parseExpenseOnly,
  parseOtherExpenseOnly,
  parseOvertimeOnly,
  parseExpenseWorkbook,
} from "@/lib/excel/expense-parser";

const wbToBuffer = (wb: XLSX.WorkBook): ArrayBuffer =>
  XLSX.write(wb, { bookType: "xlsx", type: "array" });

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

// ─── parseOtherExpenseOnly ────────────────────────────────────

const sampleOtherExpenseWb = () =>
  buildOtherExpenseWorkbook({
    formNumber: "OE-2026-0001",
    year: 2026,
    month: 4,
    applicantName: "佑霖",
    totalAmount: 300,
    totalReceipts: 1,
    items: [
      {
        date: new Date("2026-04-19T16:00:00Z"),
        itemName: "辦公用紙",
        purpose: "日常辦公",
        quantity: 2,
        unitPrice: 150,
        subtotal: 300,
        receipts: 1,
      },
    ],
  });

describe("parseOtherExpenseOnly", () => {
  it("找不到「其他費用申請單」工作表應回傳錯誤", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["test"]]), "WrongSheet");
    const result = parseOtherExpenseOnly(wbToBuffer(wb));
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("找不到");
  });

  it("有效資料應解析出 items", () => {
    const result = parseOtherExpenseOnly(wbToBuffer(sampleOtherExpenseWb()));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemName).toBe("辦公用紙");
    expect(result.items[0].purpose).toBe("日常辦公");
    expect(result.items[0].quantity).toBe(2);
  });

  it("空 items 應可解析（回傳空 items）", () => {
    const wb = buildOtherExpenseWorkbook({
      formNumber: "OE-2026-0002",
      year: 2026,
      month: 4,
      applicantName: "佑霖",
      totalAmount: 0,
      totalReceipts: 0,
      items: [],
    });
    const result = parseOtherExpenseOnly(wbToBuffer(wb));
    expect(result.items).toHaveLength(0);
  });
});

// ─── parseOvertimeOnly ────────────────────────────────────────

const sampleOvertimeWb = () =>
  buildOvertimeWorkbook({
    formNumber: "OT-2026-0001",
    year: 2026,
    month: 4,
    applicantName: "佑霖",
    totalWorkHours: 9,
    totalOvertimeHours: 9,
    totalHolidayPay: 0,
    totalOvertimePay: 5000,
    items: [
      {
        date: new Date("2026-04-19T16:00:00Z"),
        workerName: "佑霖",
        clientOrWork: "客戶 ABC",
        dayType: "REST_DAY",
        workTime: "09:00~18:00",
        workHours: 9,
        overtimeHours: 9,
        holidayDoublePay: 0,
        overtimePay: 5000,
      },
    ],
  });

describe("parseOvertimeOnly", () => {
  it("找不到「加班單」工作表應回傳錯誤", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["test"]]), "WrongSheet");
    const result = parseOvertimeOnly(wbToBuffer(wb));
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("找不到");
  });

  it("有效資料應解析出 items", () => {
    const result = parseOvertimeOnly(wbToBuffer(sampleOvertimeWb()));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].clientOrWork).toBe("客戶 ABC");
    expect(result.items[0].dayType).toBe("REST_DAY");
  });

  it("HOLIDAY 日期類型應正確解析", () => {
    const wb = buildOvertimeWorkbook({
      formNumber: "OT-2026-0002",
      year: 2026,
      month: 4,
      applicantName: "佑霖",
      totalWorkHours: 8,
      totalOvertimeHours: 0,
      totalHolidayPay: 8000,
      totalOvertimePay: 0,
      items: [
        {
          date: new Date("2026-04-03T16:00:00Z"),
          workerName: "佑霖",
          clientOrWork: "客戶 DEF",
          dayType: "HOLIDAY",
          workTime: "09:00~17:00",
          workHours: 8,
          overtimeHours: 0,
          holidayDoublePay: 8000,
          overtimePay: 0,
        },
      ],
    });
    const result = parseOvertimeOnly(wbToBuffer(wb));
    expect(result.items[0].dayType).toBe("HOLIDAY");
  });
});

// ─── parseExpenseWorkbook ─────────────────────────────────────

describe("parseExpenseWorkbook", () => {
  it("找不到任何已知工作表應三組都回傳錯誤", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["test"]]), "WrongSheet");
    const result = parseExpenseWorkbook(wbToBuffer(wb));
    expect(result.expense.errors).toHaveLength(1);
    expect(result.otherExpense.errors).toHaveLength(1);
    expect(result.overtime.errors).toHaveLength(1);
    expect(result.year).toBeGreaterThan(2000);
  });

  it("包含所有三個工作表時應各自解析成功", () => {
    const expWb = buildExpenseWorkbook({
      formNumber: "EX-2026-0001",
      applicantName: "佑霖",
      year: 2026,
      month: 4,
      totalAmount: 0,
      totalReceipts: 0,
      items: [],
    });

    // 把三個 sheet 合入同一個 workbook
    const combinedWb = XLSX.read(expWb, { type: "array" });
    const otWs = sampleOtherExpenseWb().Sheets["其他費用申請單"];
    const ovWs = sampleOvertimeWb().Sheets["加班單"];
    XLSX.utils.book_append_sheet(combinedWb, otWs, "其他費用申請單");
    XLSX.utils.book_append_sheet(combinedWb, ovWs, "加班單");

    const result = parseExpenseWorkbook(wbToBuffer(combinedWb));
    expect(result.expense.errors).toHaveLength(0);
    expect(result.otherExpense.items).toHaveLength(1);
    expect(result.overtime.items).toHaveLength(1);
  });
});
