"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createLeaveRequestSchema } from "@/lib/validators/leave";
import { calculateLeaveHours } from "@/lib/leave-utils";
import { resolveWorkflowApprovers } from "@/lib/workflow";
import { cancelSubmission } from "@/actions/approval";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { upsertAttachment } from "@/lib/attachment";

type TxClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function parseAndValidateLeaveForm(formData: FormData) {
  const raw = {
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    endDate: formData.get("endDate"),
    endTime: formData.get("endTime"),
    reason: formData.get("reason"),
  };

  let parsed: ReturnType<typeof createLeaveRequestSchema.parse>;
  try {
    parsed = createLeaveRequestSchema.parse(raw);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(e.issues.map((issue: z.ZodIssue) => issue.message).join("\n"));
    }
    throw e;
  }

  const startDateTime = new Date(`${parsed.startDate}T${parsed.startTime}:00+08:00`);
  const endDateTime = new Date(`${parsed.endDate}T${parsed.endTime}:00+08:00`);

  if (endDateTime <= startDateTime) throw new Error("結束日期不能早於起始日期");

  const hours = calculateLeaveHours(startDateTime, endDateTime);
  if (hours <= 0) throw new Error("請假時數須大於 0");

  return { parsed, startDateTime, endDateTime, hours };
}

function getTaipeiDateStr(): string {
  const now = new Date();
  const taipeiDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taipeiDate.toISOString().slice(0, 10).replace(/-/g, "");
}

async function generateLeaveFormNumber(tx: TxClient, dateStr: string): Promise<string> {
  // 找今日最大流水號，鎖定讀取避免 race condition
  const latest = await tx.leaveRequest.findFirst({
    where: { formNumber: { startsWith: dateStr } },
    orderBy: { formNumber: "desc" },
    select: { formNumber: true },
  });

  let nextSeq = 1;
  if (latest) {
    const seq = parseInt(latest.formNumber.slice(-4), 10);
    if (!isNaN(seq)) nextSeq = seq + 1;
  }

  return `${dateStr}-${String(nextSeq).padStart(4, "0")}`;
}

export async function submitLeaveRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const { parsed, startDateTime, endDateTime, hours } = parseAndValidateLeaveForm(formData);

  // 檢查是否與現有假單時段重疊（PENDING 或 APPROVED）
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      submission: {
        applicantId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      startDate: { lt: endDateTime },
      endDate: { gt: startDateTime },
    },
  });
  if (overlapping) throw new Error("申請時段與現有假單重疊，請重新選擇時間");

  // 查詢全域簽核流程設定
  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "LEAVE" },
    orderBy: { stepOrder: "asc" },
  });

  // 建立表單送出 + 請假單（交易），遇到 formNumber unique 衝突最多重試 5 次
  const dateStr = getTaipeiDateStr();
  let submission!: { id: string };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      submission = await prisma.$transaction(async (tx) => {
        const sub = await tx.formSubmission.create({
          data: {
            formType: "LEAVE",
            applicantId: session.user.id,
            status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
            currentStep: 1,
          },
        });

        const formNumber = await generateLeaveFormNumber(tx, dateStr);

        await tx.leaveRequest.create({
          data: {
            submissionId: sub.id,
            formNumber,
            leaveTypeId: parsed.leaveTypeId,
            startDate: startDateTime,
            endDate: endDateTime,
            hours,
            reason: parsed.reason,
          },
        });

        await upsertAttachment(tx, sub.id, formData);

        const approvers = await resolveWorkflowApprovers(
          tx,
          session.user.id,
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
                message: `${session.user.name ?? session.user.email} 提交了請假單，請前往簽核`,
              },
            });
          }
        }

        return sub;
      });
      break; // 成功，跳出重試迴圈
    } catch (e) {
      const isUniqueViolation =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (isUniqueViolation && attempt < 4) continue;
      throw e;
    }
  }

  revalidatePath("/");
  revalidatePath("/leave");
  revalidatePath("/outbox");

  return { id: submission.id };
}

export async function resubmitLeaveRequest(submissionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  });

  if (submission.applicantId !== session.user.id) throw new Error("只能修改自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有被退件的表單可以重送");

  const { parsed, startDateTime, endDateTime, hours } = parseAndValidateLeaveForm(formData);
  if (hours <= 0) throw new Error("請假時數須大於 0");

  // 檢查是否與其他假單時段重疊（排除本次重送的那筆）
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      submission: {
        applicantId: session.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        id: { not: submissionId },
      },
      startDate: { lt: endDateTime },
      endDate: { gt: startDateTime },
    },
  });
  if (overlapping) throw new Error("申請時段與現有假單重疊，請重新選擇時間");

  const workflowSteps = await prisma.workflowConfig.findMany({
    where: { formType: "LEAVE" },
    orderBy: { stepOrder: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    // 更新請假單內容
    await tx.leaveRequest.update({
      where: { submissionId },
      data: {
        leaveTypeId: parsed.leaveTypeId,
        startDate: startDateTime,
        endDate: endDateTime,
        hours,
        reason: parsed.reason,
      },
    });

    await upsertAttachment(tx, submissionId, formData);

    // 計算新的 round（保留歷史記錄，不刪除）
    const maxRound = await tx.approvalAction.aggregate({
      where: { submissionId },
      _max: { round: true },
    });
    const newRound = (maxRound._max.round ?? 0) + 1;

    // 重置表單狀態
    await tx.formSubmission.update({
      where: { id: submissionId },
      data: {
        status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
        currentStep: 1,
      },
    });

    // 建立新輪次的簽核關卡
    const approvers = await resolveWorkflowApprovers(
      tx,
      session.user.id,
      workflowSteps,
    );
    for (const a of approvers) {
      await tx.approvalAction.create({
        data: { submissionId, round: newRound, stepOrder: a.stepOrder, approverId: a.approverId },
      });
    }

    // 通知第一關簽核者（本輪次）
    if (workflowSteps.length > 0) {
      const firstAction = await tx.approvalAction.findFirst({
        where: { submissionId, round: newRound, stepOrder: 1 },
      });
      if (firstAction) {
        await tx.notification.create({
          data: {
            userId: firstAction.approverId,
            submissionId,
            title: "請假單已修改重送",
            message: `${session.user.name ?? session.user.email} 修改了請假單並重新送出，請前往簽核`,
          },
        });
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/leave");
  revalidatePath("/outbox");
}

export async function cancelLeaveRequest(submissionId: string) {
  await cancelSubmission(submissionId);
  revalidatePath("/leave");
}

export async function deleteLeaveRequest(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { leaveRequest: true },
  });
  if (submission.applicantId !== session.user.id) throw new Error("只能刪除自己的申請");
  if (submission.status !== "REJECTED") throw new Error("只有已退回/取回的表單可以刪除");
  if (!submission.leaveRequest) throw new Error("找不到對應的請假單");

  await prisma.leaveRequest.update({
    where: { id: submission.leaveRequest.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/leave");
  revalidatePath("/outbox");
}

export async function getLeaveTypes() {
  return prisma.leaveType.findMany({ orderBy: { name: "asc" } });
}

export async function getMyLeaveRequests() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  return prisma.formSubmission.findMany({
    where: {
      applicantId: session.user.id,
      formType: "LEAVE",
      leaveRequest: { deletedAt: null },
    },
    include: {
      leaveRequest: { include: { leaveType: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
