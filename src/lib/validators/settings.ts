import { z } from "zod/v4";

export const updateSystemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1, "請填寫設定值"),
});

export const smtpConfigSchema = z.object({
  host: z.string().min(1, "請填寫 SMTP Host"),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1, "請填寫帳號"),
  password: z.string().min(1, "請填寫密碼"),
  senderName: z.string().min(1, "請填寫寄件人名稱"),
  senderEmail: z.email("寄件人 Email 格式不正確"),
  encryption: z.enum(["TLS", "SSL"]),
});

export const workflowConfigSchema = z.object({
  departmentId: z.string().min(1, "請選擇部門"),
  formType: z.enum(["LEAVE"]),
  steps: z
    .array(
      z.object({
        stepOrder: z.number().int().min(1),
        approverRole: z.string().min(1, "請填寫簽核者角色"),
      })
    )
    .min(1, "至少需要一個簽核關卡"),
});

export type SmtpConfigInput = z.infer<typeof smtpConfigSchema>;
export type WorkflowConfigInput = z.infer<typeof workflowConfigSchema>;
