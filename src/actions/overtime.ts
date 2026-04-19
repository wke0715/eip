"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  createOvertimeRequestSchema,
  type OvertimeItemInput,
} from "@/lib/validators/overtime";
import { generateFormNumber, getTaipeiDateStr } from "@/lib/form-number";
import { cancelSubmission } from "@/actions/approval";
import { upsertAttachment } from "@/lib/attachment";
import {
  parseYearMonthItems,
  safeZodParse,
  toDateOnly,
  retryOnUniqueViolation,
  createWorkflowApprovalsAndNotify,
} from "@/lib/submission-helpers";

function computeTotals(items: OvertimeItemInput[]) {
  const totalWorkHours = items.reduce((sum, it) => sum + (it.workHours ?? 0), 0);
  const totalOvertimeHours = items.reduce((sum, it) => sum + (it.overtimeHours ?? 0), 0);
  const totalHolidayPay = items.reduce((sum, it) => sum + (it.holidayDoublePay ?? 0), 0);
  const totalOvertimePay = items.reduce((sum, it) => sum + (it.overtimePay ?? 0), 0);
  return { totalWorkHours, totalOvertimeHours, totalHolidayPay, totalOvertimePay };
}

function itemsCreateInput(items: OvertimeItemInput[]) {
  return items.map((it) => ({
    date: toDateOnly(it.date),
    workerName: it.workerName,
    clientOrWork: it.clientOrWork,
    dayType: it.dayType,
    workTime: it.workTime,
    workHours: it.workHours,
    overtimeHours: it.overtimeHours,
    holidayDoublePay: it.holidayDoublePay ?? 0,
    overtimePay: it.overtimePay ?? 0,
  }));
}

async function assertNoActiveRequestInMonth(
  applicantId: string,
  year: number,
  month: number,
  excludeSubmissionId?: string,
) {
  const existing = await prisma.overtimeRequest.findFirst({
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
    throw new Error(`${year} 年 ${month} 月已有進行中或已核准的加班單`);
  }
}

export async function submitOvertimeRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  const applicantId = session.user.id;
  const displayName = session.user.name ?? session.user.email;

  const parsed = safeZodParse(createOvertimeRequestSchema, parseYearMonthItems(formData));
  await assertNoActiveRequestInMonth(applicantId, parsed.year, parsed.month);

  const totals = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "OVERTIME" },
    orderBy: { stepOrder: "asc" },
  });

  const dateStr = getTaipeiDateStr();

  const submissionId = await retryOnUniqueViolation(() =>
    prisma.$transaction(async (tx) => {
      const sub = await tx.formSubmission.create({
        data: {
          formType: "OVERTIME",
          applicantId,
          status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
          currentStep: 1,
        },
      });

      const formNumber = await generateFormNumber(tx, "OVERTIME", dateStr);

      await tx.overtimeRequest.create({
        data: {
          submissionId: sub.id,
          formNumber,
          applicantId,
          year: parsed.year,
          month: parsed.month,
          ...totals,
          items: { create: itemsCreateInput(parsed.items) },
        },
      });

      await createWorkflowApprovalsAndNotify(tx, {
        submissionId: sub.id,
        applicantId,
        workflowSteps,
        notification: {
          title: "新的待簽核表單",
          message: `${displayName} 提交了加班單，請前往簽核`,
        },
      });

      await upsertAttachment(tx, sub.id, formData);
      return sub.id;
    }),
  );

  revalidatePath("/");
  revalidatePath("/overtime");
  revalidatePath("/outbox");
  return { id: submissionId };
}

export async function resubmitOvertimeRequest(submissionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  const applicantId = session.user.id;
  const displayName = session.user.name ?? session.user.email;

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { overtimeRequest: true },
  });

  if (submission.applicantId !== applicantId) throw new Error("只能修改自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有被退件的表單可以重送");
  if (!submission.overtimeRequest) throw new Error("找不到對應的加班單");

  const parsed = safeZodParse(createOvertimeRequestSchema, parseYearMonthItems(formData));
  await assertNoActiveRequestInMonth(applicantId, parsed.year, parsed.month, submissionId);

  const totals = computeTotals(parsed.items);

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "OVERTIME" },
    orderBy: { stepOrder: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.overtimeItem.deleteMany({
      where: { requestId: submission.overtimeRequest!.id },
    });

    await tx.overtimeRequest.update({
      where: { id: submission.overtimeRequest!.id },
      data: {
        year: parsed.year,
        month: parsed.month,
        ...totals,
        items: { create: itemsCreateInput(parsed.items) },
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

    await createWorkflowApprovalsAndNotify(tx, {
      submissionId,
      applicantId,
      workflowSteps,
      round: newRound,
      notification: {
        title: "加班單已修改重送",
        message: `${displayName} 修改了加班單並重新送出，請前往簽核`,
      },
    });

    await upsertAttachment(tx, submissionId, formData);
  });

  revalidatePath("/");
  revalidatePath("/overtime");
  revalidatePath("/outbox");
}

export async function cancelOvertimeRequest(submissionId: string) {
  await cancelSubmission(submissionId);
  revalidatePath("/overtime");
}

export async function deleteOvertimeRequest(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { overtimeRequest: true },
  });
  if (submission.applicantId !== session.user.id) throw new Error("只能刪除自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有已退回/取消的表單可以刪除");
  if (!submission.overtimeRequest) throw new Error("找不到對應的加班單");

  await prisma.overtimeRequest.update({
    where: { id: submission.overtimeRequest.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/overtime");
}

export async function getMyOvertimeRequests() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  return prisma.formSubmission.findMany({
    where: {
      applicantId: session.user.id,
      formType: "OVERTIME",
      overtimeRequest: { deletedAt: null },
    },
    include: {
      overtimeRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
