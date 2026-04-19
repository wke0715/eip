import * as XLSX from "xlsx";
import type { CalendarEventInput, ClientCalendarEventInput } from "./validators/calendar";

// Excel 欄位對應
const PERSON_COLUMNS: Record<string, string> = {
  D: "Eric",
  E: "Alice",
  F: "Nick",
  G: "Leo",
  H: "委外",
};

// 背景顏色 hex → CalendarEventStatus
// SheetJS 讀到的 fgColor 為 ARGB hex 字串（例如 "FF4472C4"）
function colorToStatus(argb: string | undefined): CalendarEventInput["status"] {
  if (!argb) return "CONFIRMED";
  // 取後 6 碼 RGB
  const rgb = argb.slice(-6).toUpperCase();

  // 紅色系（假日）：FF0000 附近
  if (/^(FF|FE|FC)[0-2][0-9A-F][0-2][0-9A-F]$/.test(rgb)) return "HOLIDAY";
  // 粉紅/橘紅系（預排未定）：FFB6C1、FFC0CB、FFB3B3、FF9999 等
  if (/^FF[6-9A-F][0-9A-F][6-9A-F][0-9A-F]$/.test(rgb)) return "TENTATIVE";
  // 藍色系（預排已確認）：4472C4、5B9BD5 等
  if (/^[0-4][0-9A-F][5-9A-F][0-9A-F][A-F][0-9A-F]$/.test(rgb)) return "CONFIRMED";
  // 黑色/深色系（完成）：000000、333333 等
  if (/^[0-3][0-9A-F][0-3][0-9A-F][0-3][0-9A-F]$/.test(rgb)) return "COMPLETED";

  return "CONFIRMED";
}

// 解析日期字串 "MM/DD(星期)" → "YYYY-MM-DD"
function parseDateString(raw: string, year: number): string | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  if (isNaN(month) || isNaN(day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 拆分 "上午任務/下午任務" → { amTask, pmTask } or { fullDayTask }
function splitTask(raw: string | null | undefined): {
  amTask: string | null;
  pmTask: string | null;
  fullDayTask: string | null;
} {
  if (!raw || raw.trim() === "") {
    return { amTask: null, pmTask: null, fullDayTask: null };
  }
  const parts = raw.split("/");
  if (parts.length === 1) {
    return { amTask: null, pmTask: null, fullDayTask: parts[0].trim() };
  }
  return {
    amTask: parts[0].trim() || null,
    pmTask: parts[1].trim() || null,
    fullDayTask: null,
  };
}

export interface ParsedCalendarData {
  events: CalendarEventInput[];
  clientEvents: ClientCalendarEventInput[];
  errors: string[];
}

function parsePersonCells(
  sheet: XLSX.WorkSheet,
  rowIdx: number,
  dateStr: string,
  weekNumber: number | null,
): CalendarEventInput[] {
  const result: CalendarEventInput[] = [];
  for (const [col, personName] of Object.entries(PERSON_COLUMNS)) {
    const colIdx = col.charCodeAt(0) - "A".charCodeAt(0);
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })];
    const rawValue = cell?.v ? String(cell.v).trim() : "";
    const fgColor: string | undefined =
      cell?.s?.fgColor?.rgb ?? cell?.s?.bgColor?.rgb ?? undefined;
    const status = colorToStatus(fgColor);
    const isHoliday = status === "HOLIDAY";
    if (!rawValue && !isHoliday) continue;
    const { amTask, pmTask, fullDayTask } = splitTask(rawValue);
    result.push({
      date: dateStr,
      personName,
      amTask,
      pmTask,
      fullDayTask,
      status,
      isHoliday,
      weekNumber,
    });
  }
  return result;
}

export function parseCalendarExcel(buffer: ArrayBuffer): ParsedCalendarData {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellStyles: true,   // 讀取顏色
    cellDates: false,
  });

  // 找「進度_2026」sheet
  const sheetName = workbook.SheetNames.find(
    (n) => n.includes("進度") || n.toLowerCase().includes("schedule")
  );
  if (!sheetName) {
    return {
      events: [],
      clientEvents: [],
      errors: ["找不到「進度_2026」工作表，請確認 Excel 格式正確"],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const errors: string[] = [];
  const events: CalendarEventInput[] = [];
  const clientEvents: ClientCalendarEventInput[] = [];

  // 推斷年份（從 sheet 名稱或當前年份）
  const yearMatch = sheetName.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  // 取得 sheet 範圍
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  let currentWeekNumber: number | null = null;

  // 從 Row 2（index 1）開始，Col A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7
  for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
    // Col A：週次（合併儲存格，只在首行有值）
    const cellA = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })];
    if (cellA?.v) {
      const wMatch = String(cellA.v).match(/W(\d+)/i);
      if (wMatch) currentWeekNumber = parseInt(wMatch[1], 10);
    }

    // Col B：日期
    const cellB = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })];
    if (!cellB?.v) continue;

    const dateStr = parseDateString(String(cellB.v), year);
    if (!dateStr) continue;

    // Col C：客戶行事曆
    const cellC = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })];
    if (cellC?.v && String(cellC.v).trim()) {
      clientEvents.push({ date: dateStr, event: String(cellC.v).trim() });
    }

    // Col D ~ H：各人員任務
    events.push(...parsePersonCells(sheet, rowIdx, dateStr, currentWeekNumber));
  }

  return { events, clientEvents, errors };
}
