"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createOtherExpenseRequestSchema,
  calcOtherExpenseSubtotal,
  type OtherExpenseItemInput,
} from "@/lib/validators/otherExpense";
import { generateFormNumber, getTaipeiDateStr } from "@/lib/form-number";
import { cancelSubmission } from "@/actions/approval";
import { resolveWorkflowApprovers } from "@/lib/workflow";
import { upsertAttachment } from "@/lib/attachment";

function parseItemsJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("明細資料格式錯誤");
  }
}

function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

function computeTotals(items: OtherExpenseItemInput[]) {
  const normalized = items.map((it) => ({
    ...it,
    subtotal: it.subtotal > 0 ? it.subtotal : calcOtherExpenseSubtotal(it),
  }));
  const totalAmount = normalized.reduce((sum, it) => sum + (it.subtotal ?? 0), 0);
  const totalReceipts = normalized.reduce((sum, it) => sum + (it.receipts ?? 0), 0);
  return { normalized, totalAmount, totalReceipts };
}

async function assertNoActiveRequestInMonth(
  applicantId: string,
  year: number,
  month: number,
  excludeSubmissionId?: string,
) {
  const existing = await prisma.otherExpenseRequest.findFirst({
    where: {
      applicantId,
      year,
      month,
      deletedAt: null,
      submission: {
        status: { in: ["PENDING", "APPROVED"] },
        ...(excludeSubmissionId ? { id: { not: excludeSubmissionId } } : {}),
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`${year} 年 ${month} 月已有進行中或已核准的其他費用申請單`);
  }
}

export async function submitOtherExpenseRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  const applicantId = session.user.id;

  const raw = {
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    items: parseItemsJson(formData.get("items")),
  };
  let parsed: ReturnType<typeof createOtherExpenseRequestSchema.parse>;
  try {
    parsed = createOtherExpenseRequestSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.issues.map((issue: z.ZodIssue) => issue.message).join("\n"));
    }
    throw e;
  }

  await assertNoActiveRequestInMonth(applicantId, parsed.year, parsed.month);

  const { normalized, totalAmount, totalReceipts } = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "OTHER_EXPENSE" },
    orderBy: { stepOrder: "asc" },
  });

  const dateStr = getTaipeiDateStr();
  let submissionId!: string;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      submissionId = await prisma.$transaction(async (tx) => {
        const sub = await tx.formSubmission.create({
          data: {
            formType: "OTHER_EXPENSE",
            applicantId,
            status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
            currentStep: 1,
          },
        });

        const formNumber = await generateFormNumber(tx, "OTHER_EXPENSE", dateStr);

        await tx.otherExpenseRequest.create({
          data: {
            submissionId: sub.id,
            formNumber,
            applicantId,
            year: parsed.year,
            month: parsed.month,
            totalAmount,
            totalReceipts,
            items: {
              create: normalized.map((it) => ({
                date: toDateOnly(it.date),
                itemName: it.itemName,
                purpose: it.purpose,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                subtotal: it.subtotal,
                receipts: it.receipts,
              })),
            },
          },
        });

        const approvers = await resolveWorkflowApprovers(
          tx,
          applicantId,
          workflowSteps,
        );
        for (const a of approvers) {
          await tx.approvalAction.create({
            data: { submissionId: sub.id, stepOrder: a.stepOrder, approverId: a.approverId },
          });
        }

        if (workflowSteps.length > 0) {
          const firstAction = await tx.approvalAction.findFirst({
            where: { submissionId: sub.id, stepOrder: 1 },
          });
          if (firstAction) {
            await tx.notification.create({
              data: {
                userId: firstAction.approverId,
                submissionId: sub.id,
                title: "新的待簽核表單",
                message: `${session.user.name ?? session.user.email} 提交了其他費用申請單，請前往簽核`,
              },
            });
          }
        }

        await upsertAttachment(tx, sub.id, formData);

        return sub.id;
      });
      break;
    } catch (e) {
      const isUniqueViolation =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (isUniqueViolation && attempt < 4) continue;
      throw e;
    }
  }

  revalidatePath("/");
  revalidatePath("/other-expense");
  revalidatePath("/outbox");
  return { id: submissionId };
}

export async function resubmitOtherExpenseRequest(submissionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  const applicantId = session.user.id;

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { otherExpenseRequest: true },
  });

  if (submission.applicantId !== applicantId) throw new Error("只能修改自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有被退件的表單可以重送");
  if (!submission.otherExpenseRequest) throw new Error("找不到對應的申請單");

  const raw = {
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    items: parseItemsJson(formData.get("items")),
  };
  let parsed: ReturnType<typeof createOtherExpenseRequestSchema.parse>;
  try {
    parsed = createOtherExpenseRequestSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.issues.map((issue: z.ZodIssue) => issue.message).join("\n"));
    }
    throw e;
  }

  await assertNoActiveRequestInMonth(applicantId, parsed.year, parsed.month, submissionId);

  const { normalized, totalAmount, totalReceipts } = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "OTHER_EXPENSE" },
    orderBy: { stepOrder: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.otherExpenseItem.deleteMany({
      where: { requestId: submission.otherExpenseRequest!.id },
    });

    await tx.otherExpenseRequest.update({
      where: { id: submission.otherExpenseRequest!.id },
      data: {
        year: parsed.year,
        month: parsed.month,
        totalAmount,
        totalReceipts,
        items: {
          create: normalized.map((it) => ({
            date: toDateOnly(it.date),
            itemName: it.itemName,
            purpose: it.purpose,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
            receipts: it.receipts,
          })),
        },
      },
    });

    const maxRound = await tx.approvalAction.aggregate({
      where: { submissionId },
      _max: { round: true },
    });
    const newRound = (maxRound._max.round ?? 0) + 1;

    await tx.formSubmission.update({
      where: { id: submissionId },
      data: {
        status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
        currentStep: 1,
      },
    });

    const approvers = await resolveWorkflowApprovers(
      tx,
      applicantId,
      workflowSteps,
    );
    for (const a of approvers) {
      await tx.approvalAction.create({
        data: { submissionId, round: newRound, stepOrder: a.stepOrder, approverId: a.approverId },
      });
    }

    if (workflowSteps.length > 0) {
      const firstAction = await tx.approvalAction.findFirst({
        where: { submissionId, round: newRound, stepOrder: 1 },
      });
      if (firstAction) {
        await tx.notification.create({
          data: {
            userId: firstAction.approverId,
            submissionId,
            title: "其他費用申請單已修改重送",
            message: `${session.user.name ?? session.user.email} 修改了其他費用申請單並重新送出，請前往簽核`,
          },
        });
      }
    }

    await upsertAttachment(tx, submissionId, formData);
  });

  revalidatePath("/");
  revalidatePath("/other-expense");
  revalidatePath("/outbox");
}

export async function cancelOtherExpenseRequest(submissionId: string) {
  await cancelSubmission(submissionId);
  revalidatePath("/other-expense");
}

export async function deleteOtherExpenseRequest(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { otherExpenseRequest: true },
  });
  if (submission.applicantId !== session.user.id) throw new Error("只能刪除自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有已退回/取消的表單可以刪除");
  if (!submission.otherExpenseRequest) throw new Error("找不到對應的申請單");

  await prisma.otherExpenseRequest.update({
    where: { id: submission.otherExpenseRequest.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/other-expense");
}

export async function getMyOtherExpenseRequests() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  return prisma.formSubmission.findMany({
    where: {
      applicantId: session.user.id,
      formType: "OTHER_EXPENSE",
      otherExpenseRequest: { deletedAt: null },
    },
    include: {
      otherExpenseRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
