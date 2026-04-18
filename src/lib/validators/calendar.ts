import { z } from "zod";

export const CalendarEventStatusSchema = z.enum([
  "CONFIRMED",
  "TENTATIVE",
  "COMPLETED",
  "HOLIDAY",
]);

export const CalendarEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式須為 YYYY-MM-DD"),
  personName: z.string().min(1, "人員名稱不可為空"),
  amTask: z.string().nullable().optional(),
  pmTask: z.string().nullable().optional(),
  fullDayTask: z.string().nullable().optional(),
  status: CalendarEventStatusSchema.optional().default("CONFIRMED"),
  isHoliday: z.boolean().optional().default(false),
  weekNumber: z.number().int().min(1).max(53).nullable().optional(),
});

export const ClientCalendarEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式須為 YYYY-MM-DD"),
  event: z.string().min(1, "事件描述不可為空"),
});

export const ImportCalendarSchema = z.object({
  events: z.array(CalendarEventSchema),
  clientEvents: z.array(ClientCalendarEventSchema),
});

export type CalendarEventInput = z.infer<typeof CalendarEventSchema>;
export type ClientCalendarEventInput = z.infer<typeof ClientCalendarEventSchema>;
export type ImportCalendarInput = z.infer<typeof ImportCalendarSchema>;
