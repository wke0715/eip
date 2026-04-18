import * as XLSX from "xlsx";
import type { CalendarEvent, ClientCalendarEvent, CalendarEventStatus } from "@prisma/client";

// ─── 設定 ─────────────────────────────────────────────────────────────────────

const PERSON_ORDER = ["Eric", "Alice", "Nick", "Leo", "委外"];

// Status → ARGB 背景色（Excel fill）
const STATUS_ARGB: Record<CalendarEventStatus, string> = {
  CONFIRMED: "FFB4C6E7", // 淺藍
  TENTATIVE: "FFFFCCCC", // 淺粉紅
  COMPLETED: "FFD9D9D9", // 淺灰
  HOLIDAY:   "FFFFC7CE", // 淺紅
};

const CHINESE_WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

function makeFill(argb: string) {
  return {
    patternType: "solid",
    fgColor: { rgb: argb },
    bgColor: { rgb: argb },
  };
}

function makeBorderCell(value: string | number | null, fill?: string): XLSX.CellObject {
  const cell: XLSX.CellObject = {
    v: value ?? "",
    t: typeof value === "number" ? "n" : "s",
    s: {
      border: {
        top:    { style: "thin", color: { rgb: "FFBFBFBF" } },
        bottom: { style: "thin", color: { rgb: "FFBFBFBF" } },
        left:   { style: "thin", color: { rgb: "FFBFBFBF" } },
        right:  { style: "thin", color: { rgb: "FFBFBFBF" } },
      },
      alignment: { vertical: "center", wrapText: false },
      ...(fill ? { fill: makeFill(fill) } : {}),
    },
  };
  return cell;
}

/** 日期 → "MM/DD(星期)" */
function formatDateLabel(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}(${CHINESE_WEEKDAY[d.getDay()]})`;
}

/** ISO date string → 當天 0:00 本地 Date */
function dbDateToLocal(iso: string | Date): Date {
  const d = new Date(iso);
  // @db.Date 存為 UTC midnight，轉成本地日期
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** 計算 ISO 週次（週一為週起點）*/
function isoWeekNumber(d: Date): number {
  const target = new Date(d.getTime());
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const week1 = new Date(target.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

/** 產生全年日期陣列 */
function getDaysOfYear(year: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, 0, 1);
  while (d.getFullYear() === year) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── 主函式 ───────────────────────────────────────────────────────────────────

export function generateCalendarExcel(
  events: CalendarEvent[],
  clientEvents: ClientCalendarEvent[],
  year: number
): Buffer {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // ── Lookup maps ──

  /** "YYYY-MM-DD" → CalendarEvent[] */
  const evByDay = new Map<string, CalendarEvent[]>();
  events.forEach((e) => {
    const d = dbDateToLocal(e.date as unknown as string);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!evByDay.has(k)) evByDay.set(k, []);
    evByDay.get(k)!.push(e);
  });

  const ceByDay = new Map<string, ClientCalendarEvent[]>();
  clientEvents.forEach((e) => {
    const d = dbDateToLocal(e.date as unknown as string);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!ceByDay.has(k)) ceByDay.set(k, []);
    ceByDay.get(k)!.push(e);
  });

  // ── Header row (Row 0) ──

  const HEADER = ["週次", "日期", "客戶行事曆", ...PERSON_ORDER];
  HEADER.forEach((h, c) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    ws[addr] = {
      v: h,
      t: "s",
      s: {
        font: { bold: true },
        fill: makeFill("FFD9E1F2"),
        border: {
          top:    { style: "medium", color: { rgb: "FF9DC3E6" } },
          bottom: { style: "medium", color: { rgb: "FF9DC3E6" } },
          left:   { style: "medium", color: { rgb: "FF9DC3E6" } },
          right:  { style: "medium", color: { rgb: "FF9DC3E6" } },
        },
        alignment: { horizontal: "center", vertical: "center" },
      },
    };
  });

  // ── Data rows ──

  const days = getDaysOfYear(year);
  const merges: XLSX.Range[] = [];
  let currentWeek = -1;
  let weekStartRow = -1;

  days.forEach((day, idx) => {
    const rowIdx = idx + 1; // Row 0 = header
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const week = isoWeekNumber(day);
    const dayEvents = evByDay.get(dateKey) ?? [];
    const dayClientEvents = ceByDay.get(dateKey) ?? [];

    // 週次合併儲存格
    if (week !== currentWeek) {
      if (currentWeek !== -1 && weekStartRow !== -1) {
        merges.push({ s: { r: weekStartRow, c: 0 }, e: { r: rowIdx - 1, c: 0 } });
      }
      currentWeek = week;
      weekStartRow = rowIdx;
    }

    // Col A: 週次（合併後只需在首行填值）
    const isFirstDayOfWeek = week !== isoWeekNumber(days[idx - 1] ?? new Date(year - 1, 11, 31));
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = makeBorderCell(
      isFirstDayOfWeek ? `W${String(week).padStart(2, "0")}` : null,
      "FFF2F2F2"
    );

    // Col B: 日期
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })] = makeBorderCell(formatDateLabel(day));

    // Col C: 客戶行事曆
    const clientText = dayClientEvents.map((e) => e.event).join("、");
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })] = makeBorderCell(clientText || null, clientText ? "FFFFF2CC" : undefined);

    // Col D~H: 各人員
    PERSON_ORDER.forEach((person, pi) => {
      const colIdx = 3 + pi;
      const ev = dayEvents.find((e) => e.personName === person);

      let taskText: string | null = null;
      let fillArgb: string | undefined;

      if (ev) {
        if (ev.fullDayTask) {
          taskText = ev.fullDayTask;
        } else if (ev.amTask || ev.pmTask) {
          taskText = [ev.amTask, ev.pmTask].filter(Boolean).join("/");
        }
        fillArgb = STATUS_ARGB[ev.status];
      }

      ws[XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })] = makeBorderCell(taskText, fillArgb);
    });
  });

  // 最後一個週次的合併
  if (weekStartRow !== -1) {
    merges.push({ s: { r: weekStartRow, c: 0 }, e: { r: days.length, c: 0 } });
  }

  // ── Sheet 設定 ──

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: days.length, c: 2 + PERSON_ORDER.length },
  });
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 6  }, // A 週次
    { wch: 14 }, // B 日期
    { wch: 24 }, // C 客戶行事曆
    { wch: 22 }, // D Eric
    { wch: 22 }, // E Alice
    { wch: 22 }, // F Nick
    { wch: 22 }, // G Leo
    { wch: 22 }, // H 委外
  ];
  ws["!rows"] = [{ hpt: 18 }]; // header 行高

  XLSX.utils.book_append_sheet(wb, ws, `進度_${year}`);

  return Buffer.from(
    XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true })
  );
}
