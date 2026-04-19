"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createOtherExpenseRequestSchema,
  calcOtherExpenseSubtotal,
  type OtherExpenseItemInput,
} from "@/lib/validators/otherExpense";
import { getTaipeiDateStr } from "@/lib/form-number";
import { cancelSubmission } from "@/actions/approval";
import { upsertAttachment } from "@/lib/attachment";
import {
  parseYearMonthItems,
  safeZodParse,
  toDateOnly,
  retryOnUniqueViolation,
  createWorkflowApprovalsAndNotify,
  requireServerAuth,
  advanceResubmit,
  createFormSubmission,
} from "@/lib/submission-helpers";

function computeTotals(items: OtherExpenseItemInput[]) {
  const normalized = items.map((it) => ({
    ...it,
    subtotal: it.subtotal > 0 ? it.subtotal : calcOtherExpenseSubtotal(it),
  }));
  const totalAmount = normalized.reduce((sum, it) => sum + (it.subtotal ?? 0), 0);
  const totalReceipts = normalized.reduce((sum, it) => sum + (it.receipts ?? 0), 0);
  return { normalized, totalAmount, totalReceipts };
}

function itemsCreateInput(items: OtherExpenseItemInput[]) {
  return items.map((it) => ({
    date: toDateOnly(it.date),
    itemName: it.itemName,
    purpose: it.purpose,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    subtotal: it.subtotal,
    receipts: it.receipts,
  }));
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
  const { applicantId, displayName } = await requireServerAuth();

  const parsed = safeZodParse(createOtherExpenseRequestSchema, parseYearMonthItems(formData));
  await assertNoActiveRequestInMonth(applicantId, parsed.year, parsed.month);

  const { normalized, totalAmount, totalReceipts } = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "OTHER_EXPENSE" },
    orderBy: { stepOrder: "asc" },
  });

  const dateStr = getTaipeiDateStr();

  const submissionId = await retryOnUniqueViolation(() =>
    prisma.$transaction(async (tx) => {
      const { sub, formNumber } = await createFormSubmission(tx, {
        formType: "OTHER_EXPENSE",
        applicantId,
        workflowSteps,
        dateStr,
      });

      await tx.otherExpenseRequest.create({
        data: {
          submissionId: sub.id,
          formNumber,
          applicantId,
          year: parsed.year,
          month: parsed.month,
          totalAmount,
          totalReceipts,
          items: { create: itemsCreateInput(normalized) },
        },
      });

      await createWorkflowApprovalsAndNotify(tx, {
        submissionId: sub.id,
        applicantId,
        workflowSteps,
        notification: {
          title: "新的待簽核表單",
          message: `${displayName} 提交了其他費用申請單，請前往簽核`,
        },
      });

      await upsertAttachment(tx, sub.id, formData);
      return sub.id;
    }),
  );

  revalidatePath("/");
  revalidatePath("/other-expense");
  revalidatePath("/outbox");
  return { id: submissionId };
}

export async function resubmitOtherExpenseRequest(submissionId: string, formData: FormData) {
  const { applicantId, displayName } = await requireServerAuth();

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { otherExpenseRequest: true },
  });

  if (submission.applicantId !== applicantId) throw new Error("只能修改自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有被退件的表單可以重送");
  if (!submission.otherExpenseRequest) throw new Error("找不到對應的申請單");

  const parsed = safeZodParse(createOtherExpenseRequestSchema, parseYearMonthItems(formData));
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
        items: { create: itemsCreateInput(normalized) },
      },
    });

    await advanceResubmit(tx, {
      submissionId,
      applicantId,
      workflowSteps,
      notification: {
        title: "其他費用申請單已修改重送",
        message: `${displayName} 修改了其他費用申請單並重新送出，請前往簽核`,
      },
    });

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
  const { applicantId: userId } = await requireServerAuth();

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { otherExpenseRequest: true },
  });
  if (submission.applicantId !== userId) throw new Error("只能刪除自己的申請");
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
  const { applicantId } = await requireServerAuth();

  return prisma.formSubmission.findMany({
    where: {
      applicantId,
      formType: "OTHER_EXPENSE",
      otherExpenseRequest: { deletedAt: null },
    },
    include: {
      otherExpenseRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
