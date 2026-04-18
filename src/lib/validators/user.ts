import { z } from "zod/v4";

export const createUserSchema = z.object({
  email: z.email("Email 格式不正確"),
  name: z.string().min(1, "請填寫姓名").max(50, "姓名最多 50 字"),
  role: z.enum(["ADMIN", "USER"]),
  managerId: z.string().optional(),
});

export const updateUserSchema = createUserSchema.extend({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
