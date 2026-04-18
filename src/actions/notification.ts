"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  await prisma.notification.update({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/inbox");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/inbox");
}

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const [pendingCount, inProgressCount, approvedCount, rejectedCount] =
    await Promise.all([
      // 待簽核（等我簽的）
      prisma.approvalAction.count({
        where: {
          approverId: session.user.id,
          action: null,
          submission: { status: "PENDING" },
        },
      }),
      // 簽核中（我送出的）
      prisma.formSubmission.count({
        where: { applicantId: session.user.id, status: "PENDING" },
      }),
      // 已結案
      prisma.formSubmission.count({
        where: { applicantId: session.user.id, status: "APPROVED" },
      }),
      // 被退簽
      prisma.formSubmission.count({
        where: { applicantId: session.user.id, status: "REJECTED" },
      }),
    ]);

  // 近 30 天簽核趨勢
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentActions = await prisma.approvalAction.findMany({
    where: {
      actedAt: { gte: thirtyDaysAgo, not: null },
    },
    select: { actedAt: true, action: true },
    orderBy: { actedAt: "asc" },
  });

  // 按日期聚合
  const trendMap = new Map<string, { approved: number; rejected: number }>();
  for (const a of recentActions) {
    if (!a.actedAt) continue;
    const dateKey = a.actedAt.toISOString().slice(0, 10);
    const entry = trendMap.get(dateKey) ?? { approved: 0, rejected: 0 };
    if (a.action === "APPROVED") entry.approved++;
    if (a.action === "REJECTED") entry.rejected++;
    trendMap.set(dateKey, entry);
  }

  const trendData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  return {
    pendingCount,
    inProgressCount,
    approvedCount,
    rejectedCount,
    trendData,
  };
}
