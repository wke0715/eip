import { z } from "zod/v4";

export const otherExpenseItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式錯誤"),
  itemName: z.string().min(1, "請填寫品名").max(100),
  purpose: z.string().min(1, "請填寫用途").max(200),
  quantity: z.number().positive("數量須大於 0"),
  unitPrice: z.number().min(0, "單價不可為負"),
  subtotal: z.number().min(0),
  receipts: z.number().int().min(0).default(0),
});

export const createOtherExpenseRequestSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  items: z.array(otherExpenseItemSchema).min(1, "至少需要一筆明細"),
});

export type OtherExpenseItemInput = z.infer<typeof otherExpenseItemSchema>;
export type CreateOtherExpenseRequestInput = z.infer<
  typeof createOtherExpenseRequestSchema
>;

export function calcOtherExpenseSubtotal(
  item: Pick<OtherExpenseItemInput, "quantity" | "unitPrice">,
): number {
  return (item.quantity ?? 0) * (item.unitPrice ?? 0);
}
