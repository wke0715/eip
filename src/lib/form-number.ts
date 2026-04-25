import type { FormType } from "@prisma/client";
import { prisma } from "./prisma";

type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const FORM_TYPE_PREFIX: Record<FormType, string> = {
  LEAVE: "",
  EXPENSE: "EX-",
  OTHER_EXPENSE: "OE-",
  OVERTIME: "OT-",
};

export function getTaipeiDateStr(date: Date = new Date()): string {
  const taipei = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return taipei.toISOString().slice(0, 10).replaceAll("-", "");
}

function prefixOf(formType: FormType): string {
  return FORM_TYPE_PREFIX[formType];
}

async function findLatestFormNumber(
  tx: TxClient,
  formType: FormType,
  dateStr: string,
): Promise<string | null> {
  const prefix = prefixOf(formType);
  const startsWith = `${prefix}${dateStr}`;

  switch (formType) {
    case "LEAVE": {
      const row = await tx.leaveRequest.findFirst({
        where: { formNumber: { startsWith } },
        orderBy: { formNumber: "desc" },
        select: { formNumber: true },
      });
      return row?.formNumber ?? null;
    }
    case "EXPENSE": {
      const row = await tx.expenseReport.findFirst({
        where: { formNumber: { startsWith } },
        orderBy: { formNumber: "desc" },
        select: { formNumber: true },
      });
      return row?.formNumber ?? null;
    }
    case "OTHER_EXPENSE": {
      const row = await tx.otherExpenseRequest.findFirst({
        where: { formNumber: { startsWith } },
        orderBy: { formNumber: "desc" },
        select: { formNumber: true },
      });
      return row?.formNumber ?? null;
    }
    case "OVERTIME": {
      const row = await tx.overtimeRequest.findFirst({
        where: { formNumber: { startsWith } },
        orderBy: { formNumber: "desc" },
        select: { formNumber: true },
      });
      return row?.formNumber ?? null;
    }
  }
}

/**
 * 生成指定表單類型的當日下一個流水號。
 * - LEAVE 維持舊格式 `YYYYMMDD-XXXX`
 * - EXPENSE / OTHER_EXPENSE / OVERTIME 為 `EX-/OE-/OT-` + `YYYYMMDD-XXXX`
 * - 遇到 unique 衝突時呼叫端應重試（最多 5 次），比照 leave.ts 既有模式
 */
export async function generateFormNumber(
  tx: TxClient,
  formType: FormType,
  dateStr: string = getTaipeiDateStr(),
): Promise<string> {
  const prefix = prefixOf(formType);
  const latest = await findLatestFormNumber(tx, formType, dateStr);

  let nextSeq = 1;
  if (latest) {
    const seq = Number.parseInt(latest.slice(-4), 10);
    if (!Number.isNaN(seq)) nextSeq = seq + 1;
  }

  return `${prefix}${dateStr}-${String(nextSeq).padStart(4, "0")}`;
}
