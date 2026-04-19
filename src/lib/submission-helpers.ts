import { Prisma } from "@prisma/client";
import { z } from "zod";
import { resolveWorkflowApprovers } from "@/lib/workflow";

export function parseItemsJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("明細資料格式錯誤");
  }
}

export function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

export function parseYearMonthItems(formData: FormData) {
  return {
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    items: parseItemsJson(formData.get("items")),
  };
}

export function safeZodParse<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.issues.map((issue) => issue.message).join("\n"));
    }
    throw e;
  }
}

export async function retryOnUniqueViolation<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const isUniqueViolation =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (isUniqueViolation && attempt < maxAttempts - 1) continue;
      throw e;
    }
  }
  throw new Error("unreachable");
}

type WorkflowStep = { stepOrder: number; approverRole: string };

export async function createWorkflowApprovalsAndNotify(
  tx: Prisma.TransactionClient,
  params: {
    submissionId: string;
    applicantId: string;
    workflowSteps: WorkflowStep[];
    round?: number;
    notification?: { title: string; message: string };
  },
): Promise<void> {
  const approvers = await resolveWorkflowApprovers(
    tx,
    params.applicantId,
    params.workflowSteps,
  );
  for (const a of approvers) {
    await tx.approvalAction.create({
      data: {
        submissionId: params.submissionId,
        ...(params.round !== undefined ? { round: params.round } : {}),
        stepOrder: a.stepOrder,
        approverId: a.approverId,
      },
    });
  }

  if (params.workflowSteps.length === 0 || !params.notification) return;

  const firstAction = await tx.approvalAction.findFirst({
    where: {
      submissionId: params.submissionId,
      ...(params.round !== undefined ? { round: params.round } : {}),
      stepOrder: 1,
    },
  });
  if (!firstAction) return;

  await tx.notification.create({
    data: {
      userId: firstAction.approverId,
      submissionId: params.submissionId,
      title: params.notification.title,
      message: params.notification.message,
    },
  });
}
