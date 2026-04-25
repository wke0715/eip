"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createExpenseReportSchema,
  calcExpenseItemSubtotal,
  type ExpenseItemInput,
} from "@/lib/validators/expense";
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
import { notifyApproverOnSubmit } from "@/lib/mailer";

function computeTotals(items: ExpenseItemInput[]) {
  const normalized = items.map((it) => ({
    ...it,
    subtotal: it.subtotal > 0 ? it.subtotal : calcExpenseItemSubtotal(it),
  }));
  const totalAmount = normalized.reduce((sum, it) => sum + (it.subtotal ?? 0), 0);
  const totalReceipts = normalized.reduce((sum, it) => sum + (it.receipts ?? 0), 0);
  return { normalized, totalAmount, totalReceipts };
}

function itemsCreateInput(items: ExpenseItemInput[]) {
  return items.map((it) => ({
    date: toDateOnly(it.date),
    days: it.days ?? 1,
    workCategory: it.workCategory,
    workDetail: it.workDetail,
    mileageSubsidy: it.mileageSubsidy ?? 0,
    parkingFee: it.parkingFee ?? 0,
    etcFee: it.etcFee ?? 0,
    gasFee: it.gasFee ?? 0,
    transportType: it.transportType ?? null,
    transportAmount: it.transportAmount ?? 0,
    mealType: it.mealType ?? null,
    mealAmount: it.mealAmount ?? 0,
    otherKind: it.otherKind ?? null,
    otherName: it.otherName ?? null,
    otherAmount: it.otherAmount ?? 0,
    subtotal: it.subtotal ?? 0,
    receipts: it.receipts ?? 0,
    remark: it.remark ?? null,
  }));
}

async function assertNoActiveReportInMonth(
  applicantId: string,
  year: number,
  month: number,
  excludeSubmissionId?: string,
) {
  const existing = await prisma.expenseReport.findFirst({
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
    throw new Error(`${year} 年 ${month} 月已有進行中或已核准的出差旅費報告單`);
  }
}

export async function submitExpenseReport(formData: FormData) {
  const { applicantId, displayName } = await requireServerAuth();

  const parsed = safeZodParse(createExpenseReportSchema, parseYearMonthItems(formData));
  await assertNoActiveReportInMonth(applicantId, parsed.year, parsed.month);

  const { normalized, totalAmount, totalReceipts } = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "EXPENSE" },
    orderBy: { stepOrder: "asc" },
  });

  const dateStr = getTaipeiDateStr();

  const submissionId = await retryOnUniqueViolation(() =>
    prisma.$transaction(async (tx) => {
      const { sub, formNumber } = await createFormSubmission(tx, {
        formType: "EXPENSE",
        applicantId,
        workflowSteps,
        dateStr,
      });

      await tx.expenseReport.create({
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
          message: `${displayName} 提交了出差旅費報告單，請前往簽核`,
        },
      });

      await upsertAttachment(tx, sub.id, formData);
      return sub.id;
    }),
  );

  revalidatePath("/");
  revalidatePath("/expense");
  revalidatePath("/outbox");

  if (workflowSteps.length > 0) {
    notifyApproverOnSubmit(submissionId).catch((e) => console.error("[EIP email] notifyApproverOnSubmit", e instanceof Error ? e.message : e));
  }

  return { id: submissionId };
}

export async function resubmitExpenseReport(submissionId: string, formData: FormData) {
  const { applicantId, displayName } = await requireServerAuth();

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { expenseReport: true },
  });

  if (submission.applicantId !== applicantId) throw new Error("只能修改自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有被退件的表單可以重送");
  if (!submission.expenseReport) throw new Error("找不到對應的報告單");

  const parsed = safeZodParse(createExpenseReportSchema, parseYearMonthItems(formData));
  await assertNoActiveReportInMonth(applicantId, parsed.year, parsed.month, submissionId);

  const { normalized, totalAmount, totalReceipts } = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "EXPENSE" },
    orderBy: { stepOrder: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.expenseReportItem.deleteMany({
      where: { reportId: submission.expenseReport!.id },
    });

    await tx.expenseReport.update({
      where: { id: submission.expenseReport!.id },
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
        title: "出差旅費報告單已修改重送",
        message: `${displayName} 修改了出差旅費報告單並重新送出，請前往簽核`,
      },
    });

    await upsertAttachment(tx, submissionId, formData);
  });

  revalidatePath("/");
  revalidatePath("/expense");
  revalidatePath("/outbox");

  if (workflowSteps.length > 0) {
    notifyApproverOnSubmit(submissionId).catch((e) => console.error("[EIP email] notifyApproverOnSubmit", e instanceof Error ? e.message : e));
  }
}

export async function cancelExpenseReport(submissionId: string) {
  await cancelSubmission(submissionId);
  revalidatePath("/expense");
}

export async function deleteExpenseReport(submissionId: string) {
  const { applicantId: userId } = await requireServerAuth();

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { expenseReport: true },
  });
  if (submission.applicantId !== userId) throw new Error("只能刪除自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有已退回/取消的表單可以刪除");
  if (!submission.expenseReport) throw new Error("找不到對應的報告單");

  await prisma.expenseReport.update({
    where: { id: submission.expenseReport.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/expense");
}

export async function getMyExpenseReports() {
  const { applicantId } = await requireServerAuth();

  return prisma.formSubmission.findMany({
    where: {
      applicantId,
      formType: "EXPENSE",
      expenseReport: { deletedAt: null },
    },
    include: {
      expenseReport: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
