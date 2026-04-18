// 上班時段（台灣時間 UTC+8）：08:00–12:00 + 13:00–17:00（共 8 小時，不含午休）
// 所有計算以 UTC+8 明確處理，不依賴伺服器本地時區

const TW_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

// 上班時段（距當天台灣時間 00:00 的分鐘數）
const WORK_PERIODS_MINUTES = [
  { start: 8 * 60, end: 12 * 60 },   // 08:00–12:00
  { start: 13 * 60, end: 17 * 60 },  // 13:00–17:00
];

/** 回傳 UTC ms 對應的「台灣時間當天 00:00」的 UTC ms */
function twDayStartMs(utcMs: number): number {
  const twMs = utcMs + TW_OFFSET_MS;
  return Math.floor(twMs / MS_PER_DAY) * MS_PER_DAY - TW_OFFSET_MS;
}

/** 回傳 UTC ms 對應的台灣時間星期幾（0=日, 6=六）*/
function twDayOfWeek(utcMs: number): number {
  // 取當天台灣時間正午來判斷，避免日期邊界誤差
  return new Date(utcMs + TW_OFFSET_MS + 12 * 60 * MS_PER_MINUTE).getUTCDay();
}

/**
 * 計算兩個 datetime 之間的實際請假時數
 * - 輸入的 Date 應以台灣時間建立（例如 new Date("2026-04-13T08:00:00+08:00")）
 * - 跳過週末（台灣時間）
 * - 只計算上班時段（08:00–12:00、13:00–17:00），每天上限 8 小時
 * - 結果以 0.5 小時為最小單位，無條件捨去
 */
export function calculateLeaveHours(start: Date, end: Date): number {
  if (end <= start) return 0;

  const startMs = start.getTime();
  const endMs = end.getTime();
  let totalMs = 0;

  let dayStartMs = twDayStartMs(startMs);
  const lastDayStartMs = twDayStartMs(endMs);

  while (dayStartMs <= lastDayStartMs) {
    const dow = twDayOfWeek(dayStartMs);
    if (dow !== 0 && dow !== 6) {
      for (const p of WORK_PERIODS_MINUTES) {
        const pStart = dayStartMs + p.start * MS_PER_MINUTE;
        const pEnd = dayStartMs + p.end * MS_PER_MINUTE;
        const s = Math.max(startMs, pStart);
        const e = Math.min(endMs, pEnd);
        if (e > s) totalMs += e - s;
      }
    }
    dayStartMs += MS_PER_DAY;
  }

  const rawHours = totalMs / MS_PER_HOUR;
  // 以 0.5 小時為最小單位，無條件捨去
  return Math.floor(rawHours * 2) / 2;
}

/**
 * 計算兩個日期之間的工作天數（台灣時間，跳過週末，整天計算）
 */
export function calculateWorkingDays(start: Date, end: Date): number {
  if (end < start) return 0;

  let count = 0;
  let dayMs = twDayStartMs(start.getTime());
  const endDayMs = twDayStartMs(end.getTime());

  while (dayMs <= endDayMs) {
    const dow = twDayOfWeek(dayMs);
    if (dow !== 0 && dow !== 6) count++;
    dayMs += MS_PER_DAY;
  }

  return count;
}
