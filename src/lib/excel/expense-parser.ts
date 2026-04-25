import * as XLSX from "xlsx";
import type { ExpenseItemInput } from "../validators/expense";
import type { OtherExpenseItemInput } from "../validators/otherExpense";
import type { OvertimeItemInput } from "../validators/overtime";
import { calcWorkHoursFromRange, splitHolidayHours } from "../validators/overtime";

const EXPENSE_SHEET_NAMES = ["出差旅費報告單"];
const OTHER_EXPENSE_SHEET_NAMES = ["其他費用申請單"];
const OVERTIME_SHEET_NAMES = ["加班單"];

export interface ParsedExpenseReport {
  items: ExpenseItemInput[];
  errors: string[];
}

export interface ParsedOtherExpenseRequest {
  items: OtherExpenseItemInput[];
  errors: string[];
}

export interface ParsedOvertimeRequest {
  items: OvertimeItemInput[];
  errors: string[];
}

export interface ParsedExpenseWorkbook {
  year: number;
  expense: ParsedExpenseReport;
  otherExpense: ParsedOtherExpenseRequest;
  overtime: ParsedOvertimeRequest;
  errors: string[];
}

// ─── 共用工具 ───

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replaceAll(/[,\s]/g, ""); // NOSONAR - intentional unknown coercion in Excel parser
  if (s === "" || s === "-") return 0;
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim(); // NOSONAR - intentional unknown coercion in Excel parser
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): string | null {
  for (const name of wb.SheetNames) {
    if (candidates.some((c) => name.includes(c))) return name;
  }
  return null;
}

function inferYearFromWorkbook(wb: XLSX.WorkBook): number {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const cellA1 = sheet["A1"];
    const text = toStr(cellA1?.v);
    const match = /(\d{4})/.exec(text);
    if (match) return Number.parseInt(match[1], 10);
  }
  return new Date().getFullYear();
}

/** 解析 "MM/DD(週)" 或 "YYYY.MM.DD" 等常見格式 → "YYYY-MM-DD" */
function parseExpenseDate(raw: string, year: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
  const full = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/.exec(trimmed);
  if (full) {
    const y = Number.parseInt(full[1], 10);
    const m = Number.parseInt(full[2], 10);
    const d = Number.parseInt(full[3], 10);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // MM/DD(週) 或 MM/DD
  const short = /^(\d{1,2})[./-](\d{1,2})/.exec(trimmed);
  if (short) {
    const m = Number.parseInt(short[1], 10);
    const d = Number.parseInt(short[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

function isSummaryRow(firstCell: string): boolean {
  return /^(總計|小計|\d+月合計)/.test(firstCell.trim());
}

// ─── 出差旅費報告單 ───

function parseExpenseSheet(
  sheet: XLSX.WorkSheet,
  year: number,
): ParsedExpenseReport {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
  });
  const items: ExpenseItemInput[] = [];
  const errors: string[] = [];

  // 前 2 行為 header，第 3 行起為資料或月份彙總
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const first = toStr(row[0]);
    if (!first) continue;
    if (isSummaryRow(first)) continue;

    const date = parseExpenseDate(first, year);
    if (!date) {
      errors.push(`第 ${i + 1} 列日期格式無法解析：${first}`);
      continue;
    }

    const days = toNumber(row[1]) || 1;
    const workDetail = toStr(row[2]);
    const mileageSubsidy = toNumber(row[3]);
    const parkingFee = toNumber(row[4]);
    const etcFee = toNumber(row[5]);
    const gasFee = toNumber(row[6]);
    const transportTypeRaw = toStr(row[7]).toUpperCase();
    const transportAmount = toNumber(row[8]);
    const mealTypeRaw = toStr(row[9]).toUpperCase();
    const mealAmount = toNumber(row[10]);
    const otherKindRaw = toStr(row[11]).toUpperCase();
    const otherAmount = toNumber(row[12]);
    const subtotal = toNumber(row[13]);
    const receipts = Math.floor(toNumber(row[14]));
    const remark = toStr(row[15]) || null;

    // 從工作項目字串嘗試推斷 workCategory（S/C/T/O）
    const catMatch = /_([SCTO])(?:[^A-Z]|$)/.exec(workDetail);
    const workCategory = (catMatch?.[1] ?? "O") as "S" | "C" | "T" | "O";

    items.push({
      date,
      days,
      workCategory,
      workDetail,
      mileageSubsidy,
      parkingFee,
      etcFee,
      gasFee,
      transportType:
        transportTypeRaw && "ACTMS".includes(transportTypeRaw)
          ? (transportTypeRaw as "A" | "C" | "T" | "M" | "S")
          : null,
      transportAmount,
      mealType:
        mealTypeRaw === "A" || mealTypeRaw === "B"
          ? mealTypeRaw
          : null,
      mealAmount,
      otherKind:
        otherKindRaw === "H" || otherKindRaw === "O"
          ? otherKindRaw
          : null,
      otherName: null,
      otherAmount,
      subtotal,
      receipts,
      remark,
    });
  }

  return { items, errors };
}

// ─── 其他費用申請單 ───

function parseOtherExpenseSheet(
  sheet: XLSX.WorkSheet,
  year: number,
): ParsedOtherExpenseRequest {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
  });
  const items: OtherExpenseItemInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const first = toStr(row[0]);
    if (!first) continue;
    if (isSummaryRow(first)) continue;

    const date = parseExpenseDate(first, year);
    if (!date) {
      errors.push(`第 ${i + 1} 列日期格式無法解析：${first}`);
      continue;
    }

    const itemName = toStr(row[1]);
    const purpose = toStr(row[2]);
    if (!itemName || !purpose) continue;

    const quantity = toNumber(row[3]) || 1;
    const unitPrice = toNumber(row[4]);
    const subtotal = toNumber(row[5]) || quantity * unitPrice;
    const receipts = Math.floor(toNumber(row[6]));

    items.push({
      date,
      itemName,
      purpose,
      quantity,
      unitPrice,
      subtotal,
      receipts,
    });
  }

  return { items, errors };
}

// ─── 加班單 ───

function parseOvertimeSheet(
  sheet: XLSX.WorkSheet,
  year: number,
): ParsedOvertimeRequest {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
  });
  const items: OvertimeItemInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const first = toStr(row[0]);
    if (!first || isSummaryRow(first)) continue;
    if (first.startsWith("註")) break; // 備註區開始就停

    const date = parseExpenseDate(first, year);
    if (!date) continue; // 空列或樣例列略過

    const workerName = toStr(row[1]);
    const clientOrWork = toStr(row[2]);
    if (!clientOrWork) continue;

    const dayTypeRaw = toStr(row[3]);
    const dayType = dayTypeRaw.includes("國定") ? "HOLIDAY" : "REST_DAY";

    const workTime = toStr(row[4]);
    const workHoursRaw = toNumber(row[5]);
    const overtimeHoursRaw = toNumber(row[6]);
    const holidayDoublePay = toNumber(row[7]);
    const overtimePay = toNumber(row[8]);

    const computedHours = calcWorkHoursFromRange(workTime);
    const workHours = workHoursRaw > 0 ? workHoursRaw : computedHours;
    const split = splitHolidayHours(workHours, dayType);
    const overtimeHours =
      overtimeHoursRaw > 0 ? overtimeHoursRaw : split.overtimeHours;

    items.push({
      date,
      workerName: workerName || "",
      clientOrWork,
      dayType,
      workTime,
      workHours,
      overtimeHours,
      holidayDoublePay,
      overtimePay,
    });
  }

  return { items, errors };
}

// ─── 入口：一次解析三個 sheet ───

export function parseExpenseWorkbook(
  buffer: ArrayBuffer,
): ParsedExpenseWorkbook {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const year = inferYearFromWorkbook(wb);
  const errors: string[] = [];

  const expSheetName = findSheet(wb, EXPENSE_SHEET_NAMES);
  const otherSheetName = findSheet(wb, OTHER_EXPENSE_SHEET_NAMES);
  const otSheetName = findSheet(wb, OVERTIME_SHEET_NAMES);

  const expense: ParsedExpenseReport = expSheetName
    ? parseExpenseSheet(wb.Sheets[expSheetName], year)
    : { items: [], errors: ["找不到「出差旅費報告單」工作表"] };

  const otherExpense: ParsedOtherExpenseRequest = otherSheetName
    ? parseOtherExpenseSheet(wb.Sheets[otherSheetName], year)
    : { items: [], errors: ["找不到「其他費用申請單」工作表"] };

  const overtime: ParsedOvertimeRequest = otSheetName
    ? parseOvertimeSheet(wb.Sheets[otSheetName], year)
    : { items: [], errors: ["找不到「加班單」工作表"] };

  return { year, expense, otherExpense, overtime, errors };
}

// 供單張 sheet 呼叫者使用（Step 2~4 各表單匯入頁會用到）
export function parseExpenseOnly(
  buffer: ArrayBuffer,
): ParsedExpenseReport & { year: number } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const year = inferYearFromWorkbook(wb);
  const name = findSheet(wb, EXPENSE_SHEET_NAMES);
  if (!name) return { items: [], errors: ["找不到「出差旅費報告單」工作表"], year };
  return { ...parseExpenseSheet(wb.Sheets[name], year), year };
}

export function parseOtherExpenseOnly(
  buffer: ArrayBuffer,
): ParsedOtherExpenseRequest & { year: number } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const year = inferYearFromWorkbook(wb);
  const name = findSheet(wb, OTHER_EXPENSE_SHEET_NAMES);
  if (!name) return { items: [], errors: ["找不到「其他費用申請單」工作表"], year };
  return { ...parseOtherExpenseSheet(wb.Sheets[name], year), year };
}

export function parseOvertimeOnly(
  buffer: ArrayBuffer,
): ParsedOvertimeRequest & { year: number } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const year = inferYearFromWorkbook(wb);
  const name = findSheet(wb, OVERTIME_SHEET_NAMES);
  if (!name) return { items: [], errors: ["找不到「加班單」工作表"], year };
  return { ...parseOvertimeSheet(wb.Sheets[name], year), year };
}
