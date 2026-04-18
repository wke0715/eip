import { z } from "zod/v4";

const timeRegex = /^([01]\d|2[0-3]):[03]0$/; // HH:00 or HH:30

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "請選擇假別"),
  startDate: z.string().min(1, "請選擇起始日期"),
  startTime: z.string().regex(timeRegex, "時間格式錯誤"),
  endDate: z.string().min(1, "請選擇結束日期"),
  endTime: z.string().regex(timeRegex, "時間格式錯誤"),
  reason: z.string().min(1, "請填寫請假事由").max(500, "請假事由最多 500 字"),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
