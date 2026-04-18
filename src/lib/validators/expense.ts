import { z } from "zod/v4";

const transportTypeSchema = z.enum(["A", "C", "T", "M", "S"]);
const mealTypeSchema = z.enum(["A", "B"]);
const otherKindSchema = z.enum(["H", "O"]);
const workCategorySchema = z.enum(["S", "C", "T", "O"]);

export const expenseItemSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式錯誤"),
    days: z.number().min(0).default(1),
    workCategory: workCategorySchema,
    workDetail: z.string().min(1, "請填寫工作項目與起訖地點").max(500),
    mileageSubsidy: z.number().min(0).default(0),
    parkingFee: z.number().min(0).default(0),
    etcFee: z.number().min(0).default(0),
    gasFee: z.number().min(0).default(0),
    transportType: transportTypeSchema.nullable().optional(),
    transportAmount: z.number().min(0).default(0),
    mealType: mealTypeSchema.nullable().optional(),
    mealAmount: z.number().min(0).default(0),
    otherKind: otherKindSchema.nullable().optional(),
    otherName: z.string().max(100).nullable().optional(),
    otherAmount: z.number().min(0).default(0),
    subtotal: z.number().min(0).default(0),
    receipts: z.number().int().min(0).default(0),
    remark: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) => (v.transportAmount > 0 ? !!v.transportType : true),
    { message: "填寫交通費金額時必須選擇交通類型", path: ["transportType"] },
  )
  .refine(
    (v) => (v.mealAmount > 0 ? !!v.mealType : true),
    { message: "填寫膳食金額時必須選擇核實/限額", path: ["mealType"] },
  )
  .refine(
    (v) => (v.otherAmount > 0 ? !!v.otherKind : true),
    { message: "填寫其他費用金額時必須選擇住宿/雜支", path: ["otherKind"] },
  );

export const createExpenseReportSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  items: z.array(expenseItemSchema).min(1, "至少需要一筆明細"),
});

export type ExpenseItemInput = z.infer<typeof expenseItemSchema>;
export type CreateExpenseReportInput = z.infer<typeof createExpenseReportSchema>;

/** 計算單筆明細小計（前端/匯入共用） */
export function calcExpenseItemSubtotal(
  item: Pick<
    ExpenseItemInput,
    | "mileageSubsidy"
    | "parkingFee"
    | "etcFee"
    | "gasFee"
    | "transportAmount"
    | "mealAmount"
    | "otherAmount"
  >,
): number {
  return (
    (item.mileageSubsidy ?? 0) +
    (item.parkingFee ?? 0) +
    (item.etcFee ?? 0) +
    (item.gasFee ?? 0) +
    (item.transportAmount ?? 0) +
    (item.mealAmount ?? 0) +
    (item.otherAmount ?? 0)
  );
}
