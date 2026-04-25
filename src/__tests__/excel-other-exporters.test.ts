import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildOvertimeWorkbook } from "@/lib/excel/overtime-exporter";
import { buildOtherExpenseWorkbook } from "@/lib/excel/other-expense-exporter";

// ─── 加班單匯出 ────────────────────────────────────────────────

describe("buildOvertimeWorkbook", () => {
  const sampleData = {
    formNumber: "OT-20260425-0001",
    year: 2026,
    month: 4,
    applicantName: "佑霖",
    totalWorkHours: 18,
    totalOvertimeHours: 10,
    totalHolidayPay: 8000,
    totalOvertimePay: 5000,
    items: [
      {
        date: new Date("2026-04-19T16:00:00Z"), // 台北 2026-04-20
        workerName: "佑霖",
        clientOrWork: "客戶 ABC 系統維護",
        dayType: "REST_DAY",
        workTime: "09:00~18:00",
        workHours: 9,
        overtimeHours: 9,
        holidayDoublePay: 0,
        overtimePay: 5000,
      },
      {
        date: new Date("2026-04-24T16:00:00Z"), // 台北 2026-04-25
        workerName: "佑霖",
        clientOrWork: "客戶 DEF 上線支援",
        dayType: "HOLIDAY",
        workTime: "09:00~18:00",
        workHours: 9,
        overtimeHours: 1,
        holidayDoublePay: 8000,
        overtimePay: 0,
      },
    ],
  };

  it("應產生包含「加班單」工作表的 Workbook", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    expect(wb.SheetNames).toContain("加班單");
  });

  it("標題列應含所有欄位名稱", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[0]).toContain("加班日期");
    expect(aoa[0]).toContain("加班人員");
    expect(aoa[0]).toContain("工作時數");
    expect(aoa[0]).toContain("加班時數");
  });

  it("資料列數應等於 items 數量", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    // 1 header + 2 items + 1 total = 4 rows
    expect(aoa.length).toBe(4);
  });

  it("日期應以台北時間格式化（YYYY-MM-DD）", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[1][0]).toBe("2026-04-20");
  });

  it("REST_DAY 應顯示「休息日」", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[1][3]).toBe("休息日");
  });

  it("HOLIDAY 應顯示「國定假日」", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[2][3]).toBe("國定假日");
  });

  it("最後一列應為合計列", () => {
    const wb = buildOvertimeWorkbook(sampleData);
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[aoa.length - 1][0]).toBe("合計");
  });

  it("items 為空仍應產生合法 Workbook", () => {
    const wb = buildOvertimeWorkbook({ ...sampleData, items: [] });
    const ws = wb.Sheets["加班單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    expect(aoa.length).toBe(2); // header + total
  });
});

// ─── 其他費用匯出 ──────────────────────────────────────────────

describe("buildOtherExpenseWorkbook", () => {
  const sampleData = {
    formNumber: "OE-20260425-0001",
    year: 2026,
    month: 4,
    applicantName: "佑霖",
    totalAmount: 600,
    totalReceipts: 3,
    items: [
      {
        date: new Date("2026-04-19T16:00:00Z"), // 台北 2026-04-20
        itemName: "辦公用紙",
        purpose: "日常辦公",
        quantity: 2,
        unitPrice: 150,
        subtotal: 300,
        receipts: 1,
      },
      {
        date: new Date("2026-04-24T16:00:00Z"), // 台北 2026-04-25
        itemName: "墨水匣",
        purpose: "列印文件",
        quantity: 1,
        unitPrice: 300,
        subtotal: 300,
        receipts: 2,
      },
    ],
  };

  it("應產生包含「其他費用申請單」工作表的 Workbook", () => {
    const wb = buildOtherExpenseWorkbook(sampleData);
    expect(wb.SheetNames).toContain("其他費用申請單");
  });

  it("標題列應含所有欄位名稱", () => {
    const wb = buildOtherExpenseWorkbook(sampleData);
    const ws = wb.Sheets["其他費用申請單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[0]).toContain("日期");
    expect(aoa[0]).toContain("品名");
    expect(aoa[0]).toContain("合計");
  });

  it("資料列數應等於 items 數量", () => {
    const wb = buildOtherExpenseWorkbook(sampleData);
    const ws = wb.Sheets["其他費用申請單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    expect(aoa.length).toBe(4); // header + 2 items + total
  });

  it("日期應正確格式化", () => {
    const wb = buildOtherExpenseWorkbook(sampleData);
    const ws = wb.Sheets["其他費用申請單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
    expect(aoa[1][0]).toBe("2026-04-20");
  });

  it("items 為空仍應產生合法 Workbook", () => {
    const wb = buildOtherExpenseWorkbook({ ...sampleData, items: [] });
    const ws = wb.Sheets["其他費用申請單"];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    expect(aoa.length).toBe(2);
  });
});
