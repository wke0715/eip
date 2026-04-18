import { z } from "zod/v4";

/** 每月加班時數超過此門檻須提醒使用者（不硬擋） */
export const OVERTIME_WARNING_HOURS = 46;

const timeRangeRegex = /^([01]\d|2[0-3]):[0-5]\d~([01]\d|2[0-3]):[0-5]\d$/;

export const overtimeItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式錯誤"),
  workerName: z.string().min(1, "請填寫加班人員").max(50),
  clientOrWork: z.string().min(1, "請填寫客戶/工作內容").max(200),
  dayType: z.enum(["REST_DAY", "HOLIDAY"]),
  workTime: z.string().regex(timeRangeRegex, "工作時間格式應為 HH:MM~HH:MM"),
  workHours: z.number().min(0),
  overtimeHours: z.number().min(0),
  holidayDoublePay: z.number().min(0).default(0),
  overtimePay: z.number().min(0).default(0),
});

export const createOvertimeRequestSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  items: z.array(overtimeItemSchema).min(1, "至少需要一筆明細"),
});

export type OvertimeItemInput = z.infer<typeof overtimeItemSchema>;
export type CreateOvertimeRequestInput = z.infer<
  typeof createOvertimeRequestSchema
>;

/**
 * 計算工作時數（time range 例如 "09:00~16:30"）
 * - 跨日不處理（加班單不支援跨日）
 * - 不扣午休（由使用者自行輸入實際工作時間）
 */
export function calcWorkHoursFromRange(range: string): number {
  const match = range.match(/^(\d{2}):(\d{2})~(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, sh, sm, eh, em] = match;
  const startMin = parseInt(sh, 10) * 60 + parseInt(sm, 10);
  const endMin = parseInt(eh, 10) * 60 + parseInt(em, 10);
  if (endMin <= startMin) return 0;
  return Math.round(((endMin - startMin) / 60) * 100) / 100;
}

/**
 * 國定假日 2 倍薪資規則：
 * 國定假日上班前 8 小時以 2 倍薪資給付，不計入加班時數；
 * 超過 8 小時的部分才計入加班時數。
 * 休息日則全部工作時數視為加班時數。
 */
export function splitHolidayHours(
  workHours: number,
  dayType: "REST_DAY" | "HOLIDAY",
): { doublePayHours: number; overtimeHours: number } {
  if (dayType === "HOLIDAY") {
    const doublePayHours = Math.min(workHours, 8);
    const overtimeHours = Math.max(0, workHours - 8);
    return { doublePayHours, overtimeHours };
  }
  return { doublePayHours: 0, overtimeHours: workHours };
}

/** 判斷某月累計加班時數是否超過 46h 警示門檻 */
export function shouldWarnOvertimeLimit(
  monthlyOvertimeHours: number,
): boolean {
  return monthlyOvertimeHours > OVERTIME_WARNING_HOURS;
}
