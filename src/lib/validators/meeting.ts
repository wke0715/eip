import { z } from "zod/v4";

export const bookMeetingSchema = z.object({
  roomId: z.string().min(1, "請選擇會議室"),
  date: z.coerce.date({ error: "請選擇日期" }),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "時間格式須為 HH:mm"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "時間格式須為 HH:mm"),
  subject: z.string().min(1, "請填寫會議主題").max(200, "會議主題最多 200 字"),
  attendeeEmails: z.array(z.email("Email 格式不正確")).optional(),
});

export type BookMeetingInput = z.infer<typeof bookMeetingSchema>;
