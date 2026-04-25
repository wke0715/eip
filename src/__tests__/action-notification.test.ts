import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockNotificationUpdate = vi.hoisted(() => vi.fn());
const mockNotificationUpdateMany = vi.hoisted(() => vi.fn());
const mockApprovalActionCount = vi.hoisted(() => vi.fn());
const mockFormSubmissionCount = vi.hoisted(() => vi.fn());
const mockApprovalActionFindMany = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
    },
    approvalAction: {
      count: mockApprovalActionCount,
      findMany: mockApprovalActionFindMany,
    },
    formSubmission: { count: mockFormSubmissionCount },
  },
}));

import {
  markNotificationRead,
  markAllNotificationsRead,
  getDashboardStats,
} from "@/actions/notification";

const authedSession = { user: { id: "user-1", email: "user@example.com" } };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── markNotificationRead ─────────────────────────────────────

describe("markNotificationRead", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(markNotificationRead("n-1")).rejects.toThrow("未登入");
  });

  it("已登入應更新通知並 revalidate", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockNotificationUpdate.mockResolvedValue({});

    await markNotificationRead("n-1");

    expect(mockNotificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "n-1", userId: "user-1" } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/inbox");
  });
});

// ─── markAllNotificationsRead ─────────────────────────────────

describe("markAllNotificationsRead", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(markAllNotificationsRead()).rejects.toThrow("未登入");
  });

  it("已登入應批次更新所有通知", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockNotificationUpdateMany.mockResolvedValue({ count: 3 });

    await markAllNotificationsRead();

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isRead: false },
        data: { isRead: true },
      })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/inbox");
  });
});

// ─── getDashboardStats ────────────────────────────────────────

describe("getDashboardStats", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getDashboardStats()).rejects.toThrow("未登入");
  });

  it("已登入應回傳儀表板統計數字", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockApprovalActionCount.mockResolvedValue(2);
    mockFormSubmissionCount.mockResolvedValue(5);
    mockApprovalActionFindMany.mockResolvedValue([]);

    const result = await getDashboardStats();

    expect(result.pendingCount).toBe(2);
    expect(result.approvedCount).toBe(5);
    expect(result.trendData).toEqual([]);
  });

  it("近 30 天有審核動作應彙整成趨勢資料", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockApprovalActionCount.mockResolvedValue(0);
    mockFormSubmissionCount.mockResolvedValue(0);
    mockApprovalActionFindMany.mockResolvedValue([
      { actedAt: new Date("2026-04-20T10:00:00Z"), action: "APPROVED" },
      { actedAt: new Date("2026-04-20T14:00:00Z"), action: "REJECTED" },
      { actedAt: new Date("2026-04-21T09:00:00Z"), action: "APPROVED" },
    ]);

    const result = await getDashboardStats();

    expect(result.trendData).toHaveLength(2);
    const apr20 = result.trendData.find((d) => d.date === "2026-04-20");
    expect(apr20).toEqual({ date: "2026-04-20", approved: 1, rejected: 1 });
  });
});
