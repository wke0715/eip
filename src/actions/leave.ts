"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLeaveRequestSchema } from "@/lib/validators/leave";
import { calculateLeaveHours } from "@/lib/leave-utils";
import { revalidatePath } from "next/cache";

export async function submitLeaveRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const raw = {
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason"),
    attachmentUrl: formData.get("attachmentUrl") || undefined,
  };

  const parsed = createLeaveRequestSchema.parse(raw);

  if (parsed.endDate < parsed.startDate) {
    throw new Error("結束日期不能早於起始日期");
  }

  const hours = calculateLeaveHours(parsed.startDate, parsed.endDate);
  if (hours <= 0) throw new Error("請假時數須大於 0");

  // 查詢簽核流程設定
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { departmentId: true },
  });

  const workflowSteps = user.departmentId
    ? await prisma.workflowConfig.findMany({
        where: { departmentId: user.departmentId, formType: "LEAVE" },
        orderBy: { stepOrder: "asc" },
      })
    : [];

  // 建立表單送出 + 請假單（交易）
  const submission = await prisma.$transaction(async (tx) => {
    const sub = await tx.formSubmission.create({
      data: {
        formType: "LEAVE",
        applicantId: session.user.id,
        status: workflowSteps.length > 0 ? "PENDING" : "APPROVED",
        currentStep: 1,
      },
    });

    await tx.leaveRequest.create({
      data: {
        submissionId: sub.id,
        leaveTypeId: parsed.leaveTypeId,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        hours,
        reason: parsed.reason,
        attachmentUrl: parsed.attachmentUrl,
      },
    });

    // 建立簽核關卡
    for (const step of workflowSteps) {
      let approverId: string | null = null;

      if (step.approverRole === "DIRECT_MANAGER") {
        const applicant = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { managerId: true },
        });
        approverId = applicant?.managerId ?? null;
      }

      if (approverId) {
        await tx.approvalAction.create({
          data: {
            submissionId: sub.id,
            stepOrder: step.stepOrder,
            approverId,
          },
        });
      }
    }

    // 通知第一關簽核者
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/outbox");

  return { id: submission.id };
}

export async function cancelLeaveRequest(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  });

  if (submission.applicantId !== session.user.id) {
    throw new Error("只能取消自己的申請");
  }

  if (submission.status !== "PENDING") {
    throw new Error("只能取消簽核中的申請");
  }

  await prisma.formSubmission.update({
    where: { id: submissionId },
    data: { status: "REJECTED" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/outbox");
}

export async function getLeaveTypes() {
  return prisma.leaveType.findMany({ orderBy: { name: "asc" } });
}

export async function getMyLeaveRequests() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  return prisma.formSubmission.findMany({
    where: { applicantId: session.user.id, formType: "LEAVE" },
    include: {
      leaveRequest: { include: { leaveType: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
