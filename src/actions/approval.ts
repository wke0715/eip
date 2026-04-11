"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function approveForm(submissionId: string, comment?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { approvalActions: { orderBy: { stepOrder: "asc" } } },
  });

  if (submission.status !== "PENDING") {
    throw new Error("此表單不在簽核中");
  }

  // 找到當前關卡
  const currentAction = submission.approvalActions.find(
    (a) => a.stepOrder === submission.currentStep && a.approverId === session.user.id
  );

  if (!currentAction) {
    throw new Error("你不是當前關卡的簽核者");
  }

  const totalSteps = submission.approvalActions.length;
  const isLastStep = submission.currentStep >= totalSteps;

  await prisma.$transaction(async (tx) => {
    // 更新簽核動作
    await tx.approvalAction.update({
      where: { id: currentAction.id },
      data: { action: "APPROVED", comment, actedAt: new Date() },
    });

    if (isLastStep) {
      // 全部核准 → 結案
      await tx.formSubmission.update({
        where: { id: submissionId },
        data: { status: "APPROVED" },
      });

      // 通知申請人
      await tx.notification.create({
        data: {
          userId: submission.applicantId,
          submissionId,
          title: "申請已核准",
          message: "你的申請已通過所有關卡核准",
        },
      });
    } else {
      // 進入下一關
      await tx.formSubmission.update({
        where: { id: submissionId },
        data: { currentStep: submission.currentStep + 1 },
      });

      // 通知下一關簽核者
      const nextAction = submission.approvalActions.find(
        (a) => a.stepOrder === submission.currentStep + 1
      );
      if (nextAction) {
        await tx.notification.create({
          data: {
            userId: nextAction.approverId,
            submissionId,
            title: "新的待簽核表單",
            message: "有一張表單等待你的簽核",
          },
        });
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
}

export async function rejectForm(submissionId: string, comment?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { approvalActions: { orderBy: { stepOrder: "asc" } } },
  });

  if (submission.status !== "PENDING") {
    throw new Error("此表單不在簽核中");
  }

  const currentAction = submission.approvalActions.find(
    (a) => a.stepOrder === submission.currentStep && a.approverId === session.user.id
  );

  if (!currentAction) {
    throw new Error("你不是當前關卡的簽核者");
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalAction.update({
      where: { id: currentAction.id },
      data: { action: "REJECTED", comment, actedAt: new Date() },
    });

    await tx.formSubmission.update({
      where: { id: submissionId },
      data: { status: "REJECTED" },
    });

    // 通知申請人
    await tx.notification.create({
      data: {
        userId: submission.applicantId,
        submissionId,
        title: "申請被退簽",
        message: `你的申請在第 ${submission.currentStep} 關被退簽${comment ? `：${comment}` : ""}`,
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
}

export async function getInboxItems() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const [pendingApprovals, notifications, completedApprovals] =
    await Promise.all([
      // 代簽核
      prisma.approvalAction.findMany({
        where: {
          approverId: session.user.id,
          action: null,
          submission: { status: "PENDING" },
        },
        include: {
          submission: {
            include: {
              applicant: { select: { name: true, email: true } },
              leaveRequest: { include: { leaveType: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // 通知
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // 已簽核
      prisma.approvalAction.findMany({
        where: {
          approverId: session.user.id,
          action: { not: null },
        },
        include: {
          submission: {
            include: {
              applicant: { select: { name: true, email: true } },
              leaveRequest: { include: { leaveType: true } },
            },
          },
        },
        orderBy: { actedAt: "desc" },
        take: 50,
      }),
    ]);

  return { pendingApprovals, notifications, completedApprovals };
}

export async function getOutboxItems() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const [pending, approved, rejected] = await Promise.all([
    prisma.formSubmission.findMany({
      where: { applicantId: session.user.id, status: "PENDING" },
      include: {
        leaveRequest: { include: { leaveType: true } },
        approvalActions: {
          include: { approver: { select: { name: true, email: true } } },
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formSubmission.findMany({
      where: { applicantId: session.user.id, status: "APPROVED" },
      include: { leaveRequest: { include: { leaveType: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.formSubmission.findMany({
      where: { applicantId: session.user.id, status: "REJECTED" },
      include: { leaveRequest: { include: { leaveType: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  return { pending, approved, rejected };
}
