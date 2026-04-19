import { Prisma } from "@prisma/client";
import type { FormType } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveWorkflowApprovers } from "@/lib/workflow";
import { generateFormNumber } from "@/lib/form-number";

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

export function toDateStr(d: Date): string {
  return new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

export async function requireServerAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  return {
    applicantId: session.user.id,
    displayName: (session.user.name ?? session.user.email) as string,
  };
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
        ...(params.round === undefined ? {} : { round: params.round }),
        stepOrder: a.stepOrder,
        approverId: a.approverId,
      },
    });
  }

  if (params.workflowSteps.length === 0 || !params.notification) return;

  const firstAction = await tx.approvalAction.findFirst({
    where: {
      submissionId: params.submissionId,
      ...(params.round === undefined ? {} : { round: params.round }),
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

export async function createFormSubmission(
  tx: Prisma.TransactionClient,
  params: {
    formType: FormType;
    applicantId: string;
    workflowSteps: { stepOrder: number }[];
    dateStr: string;
  },
) {
  const sub = await tx.formSubmission.create({
    data: {
      formType: params.formType,
      applicantId: params.applicantId,
      status: params.workflowSteps.length > 0 ? "PENDING" : "APPROVED",
      currentStep: 1,
    },
  });
  const formNumber = await generateFormNumber(tx, params.formType, params.dateStr);
  return { sub, formNumber };
}

export async function advanceResubmit(
  tx: Prisma.TransactionClient,
  params: {
    submissionId: string;
    applicantId: string;
    workflowSteps: WorkflowStep[];
    notification: { title: string; message: string };
  },
): Promise<void> {
  const maxRound = await tx.approvalAction.aggregate({
    where: { submissionId: params.submissionId },
    _max: { round: true },
  });
  const newRound = (maxRound._max.round ?? 0) + 1;

  await tx.formSubmission.update({
    where: { id: params.submissionId },
    data: {
      status: params.workflowSteps.length > 0 ? "PENDING" : "APPROVED",
      currentStep: 1,
    },
  });

  await createWorkflowApprovalsAndNotify(tx, {
    submissionId: params.submissionId,
    applicantId: params.applicantId,
    workflowSteps: params.workflowSteps,
    round: newRound,
    notification: params.notification,
  });
}
