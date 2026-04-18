"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createExpenseReportSchema,
  calcExpenseItemSubtotal,
  type ExpenseItemInput,
} from "@/lib/validators/expense";
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
  // 台北時區午夜（避免 UTC 日期偏移）
  return new Date(`${dateStr}T00:00:00+08:00`);
}

function computeTotals(items: ExpenseItemInput[]) {
  const normalized = items.map((it) => ({
    ...it,
    subtotal: it.subtotal > 0 ? it.subtotal : calcExpenseItemSubtotal(it),
  }));
  const totalAmount = normalized.reduce((sum, it) => sum + (it.subtotal ?? 0), 0);
  const totalReceipts = normalized.reduce((sum, it) => sum + (it.receipts ?? 0), 0);
  return { normalized, totalAmount, totalReceipts };
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  const applicantId = session.user.id;

  const raw = {
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    items: parseItemsJson(formData.get("items")),
  };
  let parsed: ReturnType<typeof createExpenseReportSchema.parse>;
  try {
    parsed = createExpenseReportSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.issues.map((issue: z.ZodIssue) => issue.message).join("\n"));
    }
    throw e;
  }

  await assertNoActiveReportInMonth(applicantId, parsed.year, parsed.month);

  const { normalized, totalAmount, totalReceipts } = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "EXPENSE" },
    orderBy: { stepOrder: "asc" },
  });

  const dateStr = getTaipeiDateStr();
  let submissionId!: string;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      submissionId = await prisma.$transaction(async (tx) => {
        const sub = await tx.formSubmission.create({
          data: {
            formType: "EXPENSE",
            applicantId,
            status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
            currentStep: 1,
          },
        });

        const formNumber = await generateFormNumber(tx, "EXPENSE", dateStr);

        await tx.expenseReport.create({
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
                message: `${session.user.name ?? session.user.email} 提交了出差旅費報告單，請前往簽核`,
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
  revalidatePath("/expense");
  revalidatePath("/outbox");
  return { id: submissionId };
}

export async function resubmitExpenseReport(submissionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  const applicantId = session.user.id;

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { expenseReport: true },
  });

  if (submission.applicantId !== applicantId) throw new Error("只能修改自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有被退件的表單可以重送");
  if (!submission.expenseReport) throw new Error("找不到對應的報告單");

  const raw = {
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    items: parseItemsJson(formData.get("items")),
  };
  let parsed: ReturnType<typeof createExpenseReportSchema.parse>;
  try {
    parsed = createExpenseReportSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.issues.map((issue: z.ZodIssue) => issue.message).join("\n"));
    }
    throw e;
  }

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
        items: {
          create: normalized.map((it) => ({
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
            title: "出差旅費報告單已修改重送",
            message: `${session.user.name ?? session.user.email} 修改了出差旅費報告單並重新送出，請前往簽核`,
          },
        });
      }
    }

    await upsertAttachment(tx, submissionId, formData);
  });

  revalidatePath("/");
  revalidatePath("/expense");
  revalidatePath("/outbox");
}

export async function cancelExpenseReport(submissionId: string) {
  await cancelSubmission(submissionId);
  revalidatePath("/expense");
}

export async function deleteExpenseReport(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { expenseReport: true },
  });
  if (submission.applicantId !== session.user.id) throw new Error("只能刪除自己的申請");
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  return prisma.formSubmission.findMany({
    where: {
      applicantId: session.user.id,
      formType: "EXPENSE",
      expenseReport: { deletedAt: null },
    },
    include: {
      expenseReport: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
