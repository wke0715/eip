"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseCalendarExcel } from "@/lib/excel-parser";
import { CalendarEventSchema } from "@/lib/validators/calendar";
import type { CalendarEventStatus } from "@prisma/client";

// ─── 匯入 Excel ───

export async function importCalendarFromExcel(
  formData: FormData
): Promise<{ success: boolean; message: string; imported?: number }> {
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return { success: false, message: "請選擇 Excel 檔案" };
  }

  const buffer = await file.arrayBuffer();
  const { events, clientEvents, errors } = parseCalendarExcel(buffer);

  if (errors.length > 0) {
    return { success: false, message: errors[0] };
  }

  let imported = 0;

  // upsert CalendarEvent（一人一天唯一）
  for (const ev of events) {
    const parsed = CalendarEventSchema.safeParse(ev);
    if (!parsed.success) continue;

    const { date, personName, amTask, pmTask, fullDayTask, status, isHoliday, weekNumber } =
      parsed.data;

    await _upsertEvent(date, personName, amTask, pmTask, fullDayTask, status, isHoliday, weekNumber);
    imported++;
  }

  // upsert ClientCalendarEvent（一天可多筆，先刪後插）
  if (clientEvents.length > 0) {
    const uniqueDates = [...new Set(clientEvents.map((e) => e.date))];
    for (const dateStr of uniqueDates) {
      await prisma.clientCalendarEvent.deleteMany({
        where: { date: new Date(dateStr) },
      });
    }
    await prisma.clientCalendarEvent.createMany({
      data: clientEvents.map((e) => ({
        date: new Date(e.date),
        event: e.event,
      })),
    });
  }

  revalidatePath("/calendar");
  return {
    success: true,
    message: `成功匯入 ${imported} 筆人員行程、${clientEvents.length} 筆客戶行事曆`,
    imported,
  };
}

// ─── 查詢行事曆資料 ───

export interface CalendarQueryParams {
  year: number;
  month?: number;       // 1-12，不傳則查全年
  personName?: string;  // 不傳則查所有人
}

export async function getCalendarEvents(params: CalendarQueryParams) {
  const { year, month, personName } = params;

  const startDate = month
    ? new Date(year, month - 1, 1)
    : new Date(year, 0, 1);
  const endDate = month
    ? new Date(year, month, 0, 23, 59, 59) // 當月最後一天
    : new Date(year, 11, 31, 23, 59, 59);

  const [events, clientEvents] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(personName ? { personName } : {}),
      },
      orderBy: [{ date: "asc" }, { personName: "asc" }],
    }),
    prisma.clientCalendarEvent.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    }),
  ]);

  return { events, clientEvents };
}

// ─── 取得所有人員名單 ───

export async function getCalendarPersonNames(): Promise<string[]> {
  const result = await prisma.calendarEvent.findMany({
    select: { personName: true },
    distinct: ["personName"],
    orderBy: { personName: "asc" },
  });
  return result.map((r) => r.personName);
}

// ─── 內部 helper ───

async function _upsertEvent(
  date: string,
  personName: string,
  amTask: string | null | undefined,
  pmTask: string | null | undefined,
  fullDayTask: string | null | undefined,
  status: string,
  isHoliday: boolean | undefined,
  weekNumber: number | null | undefined,
) {
  await prisma.calendarEvent.upsert({
    where: { date_personName: { date: new Date(date), personName } },
    update: {
      amTask: amTask ?? null,
      pmTask: pmTask ?? null,
      fullDayTask: fullDayTask ?? null,
      status: status as CalendarEventStatus,
      isHoliday: isHoliday ?? false,
      weekNumber: weekNumber ?? null,
    },
    create: {
      date: new Date(date),
      personName,
      amTask: amTask ?? null,
      pmTask: pmTask ?? null,
      fullDayTask: fullDayTask ?? null,
      status: status as CalendarEventStatus,
      isHoliday: isHoliday ?? false,
      weekNumber: weekNumber ?? null,
    },
  });
}

// ─── 單筆 upsert（手動編輯用）───

export async function upsertCalendarEvent(input: {
  date: string;
  personName: string;
  amTask?: string | null;
  pmTask?: string | null;
  fullDayTask?: string | null;
  status?: CalendarEventStatus;
  isHoliday?: boolean;
  weekNumber?: number | null;
}) {
  const parsed = CalendarEventSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const { date, personName, amTask, pmTask, fullDayTask, status, isHoliday, weekNumber } =
    parsed.data;

  await _upsertEvent(date, personName, amTask, pmTask, fullDayTask, status, isHoliday, weekNumber);

  revalidatePath("/calendar");
  return { success: true, message: "儲存成功" };
}

// ─── 刪除單筆 ───

export async function deleteCalendarEvent(date: string, personName: string) {
  const deleted = await prisma.calendarEvent.deleteMany({
    where: { date: new Date(date), personName },
  });

  revalidatePath("/calendar");
  return {
    success: deleted.count > 0,
    message: deleted.count > 0 ? "已刪除" : "找不到該筆資料",
  };
}
