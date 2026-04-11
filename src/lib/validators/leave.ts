import { z } from "zod/v4";

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "請選擇假別"),
  startDate: z.coerce.date({ error: "請選擇起始日期" }),
  endDate: z.coerce.date({ error: "請選擇結束日期" }),
  reason: z.string().min(1, "請填寫請假事由").max(500, "請假事由最多 500 字"),
  attachmentUrl: z.string().optional(),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
