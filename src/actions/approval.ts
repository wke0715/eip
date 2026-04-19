"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function approveForm(submissionId: string, comment?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { approvalActions: { orderBy: [{ round: "asc" }, { stepOrder: "asc" }] } },
  });

  if (submission.status !== "PENDING") {
    throw new Error("此表單不在簽核中");
  }

  // 找出當前 round（有待處理 action 的最小 round）
  const pendingRounds = submission.approvalActions
    .filter((a) => a.action === null)
    .map((a) => a.round);
  if (pendingRounds.length === 0) throw new Error("此表單不在簽核中");
  const currentRound = Math.min(...pendingRounds);

  // 只看當前 round 的 actions
  const roundActions = submission.approvalActions.filter(
    (a) => a.round === currentRound
  );

  // 找到當前關卡
  const currentAction = roundActions.find(
    (a) => a.stepOrder === submission.currentStep && a.approverId === session.user.id
  );

  if (!currentAction) {
    throw new Error("你不是當前關卡的簽核者");
  }

  const totalSteps = roundActions.length;
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

  revalidatePath("/");
  revalidatePath("/inbox");
}

export async function rejectForm(submissionId: string, comment?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { approvalActions: { orderBy: [{ round: "asc" }, { stepOrder: "asc" }] } },
  });

  if (submission.status !== "PENDING") {
    throw new Error("此表單不在簽核中");
  }

  // 找出當前 round（有待處理 action 的最小 round）
  const pendingRoundsR = submission.approvalActions
    .filter((a) => a.action === null)
    .map((a) => a.round);
  if (pendingRoundsR.length === 0) throw new Error("此表單不在簽核中");
  const currentRoundR = Math.min(...pendingRoundsR);

  const currentAction = submission.approvalActions.find(
    (a) =>
      a.round === currentRoundR &&
      a.stepOrder === submission.currentStep &&
      a.approverId === session.user.id
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
        message: `你的申請在第 ${submission.currentStep} 關被退簽${comment ? "：" + comment : ""}`,
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/inbox");
}

export async function cancelSubmission(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submission = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { approvalActions: { orderBy: [{ round: "asc" }, { stepOrder: "asc" }] } },
  });

  if (submission.applicantId !== session.user.id) {
    throw new Error("只能取回自己的申請");
  }
  if (submission.status !== "PENDING") {
    throw new Error("只有簽核中的表單可以取回");
  }

  const pendingRounds = submission.approvalActions
    .filter((a) => a.action === null)
    .map((a) => a.round);
  const currentRound =
    pendingRounds.length > 0 ? Math.min(...pendingRounds) : null;
  const currentAction =
    currentRound === null
      ? undefined
      : submission.approvalActions.find(
          (a) => a.round === currentRound && a.stepOrder === submission.currentStep
        );

  await prisma.$transaction(async (tx) => {
    await tx.formSubmission.update({
      where: { id: submissionId },
      data: { status: "REJECTED", cancelledByApplicant: true },
    });

    if (currentAction) {
      await tx.approvalAction.update({
        where: { id: currentAction.id },
        data: {
          action: "REJECTED",
          comment: "申請人自行取回",
          actedAt: new Date(),
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/outbox");
}

export async function getInboxItems() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const submissionInclude = {
    applicant: { select: { name: true, email: true } },
    leaveRequest: { include: { leaveType: true } },
    expenseReport: true,
    overtimeRequest: true,
    otherExpenseRequest: true,
  } satisfies Prisma.FormSubmissionInclude;

  const [allPendingApprovals, notifications, completedApprovals] =
    await Promise.all([
      // 代簽核（先撈出再過濾 currentStep）
      prisma.approvalAction.findMany({
        where: {
          approverId: session.user.id,
          action: null,
          submission: { status: "PENDING" },
        },
        include: {
          submission: { include: submissionInclude },
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
          submission: { include: submissionInclude },
        },
        orderBy: { actedAt: "desc" },
        take: 50,
      }),
    ]);

  // 只顯示輪到自己的關卡（stepOrder === submission.currentStep）
  const pendingApprovals = allPendingApprovals.filter(
    (a) => a.stepOrder === a.submission.currentStep
  );

  return { pendingApprovals, notifications, completedApprovals };
}

export async function getOutboxItems() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const notDeleted = {
    OR: [
      { formType: "LEAVE", leaveRequest: { deletedAt: null } },
      { formType: "EXPENSE", expenseReport: { deletedAt: null } },
      { formType: "OVERTIME", overtimeRequest: { deletedAt: null } },
      { formType: "OTHER_EXPENSE", otherExpenseRequest: { deletedAt: null } },
    ],
  } satisfies Prisma.FormSubmissionWhereInput;

  const formInclude = {
    leaveRequest: { include: { leaveType: true } },
    expenseReport: true,
    overtimeRequest: true,
    otherExpenseRequest: true,
  } satisfies Prisma.FormSubmissionInclude;

  const [pending, approved, rejected] = await Promise.all([
    prisma.formSubmission.findMany({
      where: { applicantId: session.user.id, status: "PENDING", ...notDeleted },
      include: {
        ...formInclude,
        approvalActions: {
          include: { approver: { select: { name: true, email: true } } },
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formSubmission.findMany({
      where: { applicantId: session.user.id, status: "APPROVED", ...notDeleted },
      include: formInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.formSubmission.findMany({
      where: { applicantId: session.user.id, status: "REJECTED", ...notDeleted },
      include: formInclude,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return { pending, approved, rejected };
}

export async function getSubmissionDetail(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  return prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      applicant: { select: { name: true, email: true } },
      leaveRequest: {
        include: { leaveType: true },
      },
      expenseReport: {
        include: { items: { orderBy: { date: "asc" } } },
      },
      otherExpenseRequest: {
        include: { items: { orderBy: { date: "asc" } } },
      },
      overtimeRequest: {
        include: { items: { orderBy: { date: "asc" } } },
      },
      approvalActions: {
        include: {
          approver: { select: { name: true, email: true } },
        },
        orderBy: [{ round: "asc" }, { stepOrder: "asc" }],
      },
      attachment: { select: { fileName: true } },
    },
  });
}
