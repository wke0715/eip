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
  const match = /^(\d{1,2})\/(\d{1,2})/.exec(raw);
  if (!match) return null;
  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  if (Number.isNaN(month) || Number.isNaN(day)) return null;
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
    const colIdx = (col.codePointAt(0) ?? 0) - ("A".codePointAt(0) ?? 0);
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

type RowState = {
  currentWeekNumber: number | null;
  currentYear: number;
  lastParsedMonth: number;
};

function processRow(
  sheet: XLSX.WorkSheet,
  rowIdx: number,
  state: RowState,
): { dateStr: string; clientEvent: string | null } | null {
  const cellA = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })];
  if (cellA?.v) {
    const wMatch = /W(\d+)/i.exec(String(cellA.v));
    if (wMatch) state.currentWeekNumber = Number.parseInt(wMatch[1], 10);
  }

  const cellB = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })];
  if (!cellB?.v) return null;

  const rawDate = String(cellB.v);
  const monthMatch = /^(\d{1,2})\//.exec(rawDate);
  if (!monthMatch) return null;

  const parsedMonth = Number.parseInt(monthMatch[1], 10);
  if (state.lastParsedMonth > 0 && parsedMonth < state.lastParsedMonth - 1) {
    state.currentYear++;
  }
  state.lastParsedMonth = parsedMonth;

  const dateStr = parseDateString(rawDate, state.currentYear);
  if (!dateStr) return null;

  const cellC = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })];
  const clientEvent = cellC?.v ? String(cellC.v).trim() || null : null;

  return { dateStr, clientEvent };
}

export function parseCalendarExcel(buffer: ArrayBuffer): ParsedCalendarData {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellStyles: true,
    cellDates: false,
  });

  const sheetName = workbook.SheetNames.find(
    (n) => n.includes("進度") || n.toLowerCase().includes("schedule"),
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

  const yearMatch = sheetName.match(/(\d{4})/);
  const baseYear = yearMatch ? Number.parseInt(yearMatch[1], 10) : new Date().getFullYear();
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const state: RowState = { currentWeekNumber: null, currentYear: baseYear, lastParsedMonth: 0 };

  for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
    const row = processRow(sheet, rowIdx, state);
    if (!row) continue;
    if (row.clientEvent) clientEvents.push({ date: row.dateStr, event: row.clientEvent });
    events.push(...parsePersonCells(sheet, rowIdx, row.dateStr, state.currentWeekNumber));
  }

  return { events, clientEvents, errors };
}
