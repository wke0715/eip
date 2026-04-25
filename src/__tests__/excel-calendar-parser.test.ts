import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock XLSX before importing the module
const mockRead = vi.hoisted(() => vi.fn());
const mockEncodeCell = vi.hoisted(() => vi.fn((pos: { r: number; c: number }) => `${String.fromCharCode(65 + pos.c)}${pos.r + 1}`));
const mockDecodeRange = vi.hoisted(() => vi.fn());

vi.mock("xlsx", () => ({
  read: mockRead,
  utils: {
    encode_cell: mockEncodeCell,
    decode_range: mockDecodeRange,
  },
}));

import { parseCalendarExcel } from "@/lib/excel-parser";

// Helper to build a minimal WorkSheet with cells
function makeSheet(cells: Record<string, { v: unknown; s?: { fgColor?: { rgb: string } } }>, rangeRows = 5) {
  const sheet: Record<string, unknown> = { "!ref": `A1:H${rangeRows + 1}`, ...cells };
  return sheet;
}

function makeWorkbook(sheetName: string, sheet: unknown) {
  return {
    SheetNames: [sheetName],
    Sheets: { [sheetName]: sheet },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDecodeRange.mockReturnValue({ e: { r: 5, c: 7 } });
});

describe("parseCalendarExcel", () => {
  it("找不到進度工作表應回傳錯誤", () => {
    mockRead.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("找不到");
    expect(result.events).toHaveLength(0);
  });

  it("空白工作表應回傳空陣列", () => {
    const sheet = makeSheet({});
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 1, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    expect(result.errors).toHaveLength(0);
    expect(result.events).toHaveLength(0);
    expect(result.clientEvents).toHaveLength(0);
  });

  it("有日期列應解析人員事件", () => {
    // B2 = "4/25(五)", D2 = 人員 Eric 的任務
    const sheet = makeSheet({
      B2: { v: "4/25(五)" },
      D2: { v: "開會" },
    }, 2);
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 2, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    expect(result.errors).toHaveLength(0);
    expect(result.events.length).toBeGreaterThan(0);
    const eric = result.events.find((e) => e.personName === "Eric");
    expect(eric).toBeDefined();
    expect(eric?.date).toBe("2026-04-25");
    expect(eric?.fullDayTask).toBe("開會");
  });

  it("有 W 標記列應記錄週次", () => {
    const sheet = makeSheet({
      A2: { v: "W17" },
      B3: { v: "4/25(五)" },
      D3: { v: "測試" },
    }, 3);
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 3, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    const event = result.events.find((e) => e.personName === "Eric");
    expect(event?.weekNumber).toBe(17);
  });

  it("C 欄有客戶行事曆應加入 clientEvents", () => {
    const sheet = makeSheet({
      B2: { v: "4/25(五)" },
      C2: { v: "客戶拜訪 ABC" },
    }, 2);
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 2, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    expect(result.clientEvents).toHaveLength(1);
    expect(result.clientEvents[0].event).toBe("客戶拜訪 ABC");
    expect(result.clientEvents[0].date).toBe("2026-04-25");
  });

  it("任務含斜線應分割為上下午", () => {
    const sheet = makeSheet({
      B2: { v: "4/25(五)" },
      D2: { v: "上午開會/下午開發" },
    }, 2);
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 2, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    const eric = result.events.find((e) => e.personName === "Eric");
    expect(eric?.amTask).toBe("上午開會");
    expect(eric?.pmTask).toBe("下午開發");
    expect(eric?.fullDayTask).toBeNull();
  });

  it("工作表名稱含 schedule 亦可辨識", () => {
    const sheet = makeSheet({});
    mockRead.mockReturnValue(makeWorkbook("Project Schedule", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 1, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    expect(result.errors).toHaveLength(0);
  });

  it("紅色背景應標記為 HOLIDAY", () => {
    const sheet = makeSheet({
      B2: { v: "4/25(五)" },
      D2: { v: "", s: { fgColor: { rgb: "FF0000" } } },
    }, 2);
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 2, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    const eric = result.events.find((e) => e.personName === "Eric");
    expect(eric?.status).toBe("HOLIDAY");
    expect(eric?.isHoliday).toBe(true);
  });

  it("無效的 B 欄日期格式應跳過該列", () => {
    const sheet = makeSheet({
      B2: { v: "標題列" },
      D2: { v: "任務" },
    }, 2);
    mockRead.mockReturnValue(makeWorkbook("進度_2026", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 2, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    expect(result.events).toHaveLength(0);
  });

  it("年份從工作表名稱解析（進度_2025）", () => {
    const sheet = makeSheet({
      B2: { v: "12/25(四)" },
      D2: { v: "聖誕" },
    }, 2);
    mockRead.mockReturnValue(makeWorkbook("進度_2025", sheet));
    mockDecodeRange.mockReturnValue({ e: { r: 2, c: 7 } });

    const result = parseCalendarExcel(new ArrayBuffer(0));

    const eric = result.events.find((e) => e.personName === "Eric");
    expect(eric?.date.startsWith("2025")).toBe(true);
  });
});
