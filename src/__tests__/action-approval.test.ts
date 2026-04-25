import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockNotifyApproverOnSubmit = vi.hoisted(() => vi.fn());
const mockNotifyApplicantApproved = vi.hoisted(() => vi.fn());
const mockNotifyApplicantRejected = vi.hoisted(() => vi.fn());

const mockTx = {
  approvalAction: { update: vi.fn() },
  formSubmission: { update: vi.fn() },
  notification: { create: vi.fn() },
};

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  formSubmission: { findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
  approvalAction: { findMany: vi.fn() },
  notification: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/mailer", () => ({
  notifyApproverOnSubmit: mockNotifyApproverOnSubmit,
  notifyApplicantApproved: mockNotifyApplicantApproved,
  notifyApplicantRejected: mockNotifyApplicantRejected,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  approveForm,
  rejectForm,
  cancelSubmission,
  getInboxItems,
  getOutboxItems,
  getSubmissionDetail,
} from "@/actions/approval";

const authedSession = { user: { id: "approver-1", email: "approver@example.com" } };

function makeSubmission(overrides: Partial<{
  status: string;
  currentStep: number;
  applicantId: string;
  approvalActions: object[];
}> = {}) {
  return {
    id: "sub-1",
    applicantId: "user-1",
    status: "PENDING",
    currentStep: 1,
    cancelledByApplicant: false,
    approvalActions: [
      { id: "aa-1", round: 1, stepOrder: 1, approverId: "approver-1", action: null },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.approvalAction.update.mockResolvedValue({});
  mockTx.formSubmission.update.mockResolvedValue({});
  mockTx.notification.create.mockResolvedValue({});
  mockNotifyApplicantApproved.mockResolvedValue(undefined);
  mockNotifyApplicantRejected.mockResolvedValue(undefined);
  mockNotifyApproverOnSubmit.mockResolvedValue(undefined);
});

// ─── approveForm ──────────────────────────────────────────────

describe("approveForm", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(approveForm("sub-1")).rejects.toThrow("未登入");
  });

  it("表單非 PENDING 狀態應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(makeSubmission({ status: "APPROVED" }));
    await expect(approveForm("sub-1")).rejects.toThrow("此表單不在簽核中");
  });

  it("無待處理 action 應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({
        approvalActions: [
          { id: "aa-1", round: 1, stepOrder: 1, approverId: "approver-1", action: "APPROVED" },
        ],
      })
    );
    await expect(approveForm("sub-1")).rejects.toThrow("此表單不在簽核中");
  });

  it("不是當前關卡簽核者應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({
        approvalActions: [
          { id: "aa-1", round: 1, stepOrder: 1, approverId: "other-approver", action: null },
        ],
      })
    );
    await expect(approveForm("sub-1")).rejects.toThrow("你不是當前關卡的簽核者");
  });

  it("最後一關核准應更新為 APPROVED 並通知申請人", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(makeSubmission());

    await approveForm("sub-1", "同意");

    expect(mockTx.approvalAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "aa-1" },
        data: expect.objectContaining({ action: "APPROVED" }),
      })
    );
    expect(mockTx.formSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "APPROVED" } })
    );
    expect(mockNotifyApplicantApproved).toHaveBeenCalledWith("sub-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/inbox");
  });

  it("非最後一關核准應進入下一關卡", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({
        currentStep: 1,
        approvalActions: [
          { id: "aa-1", round: 1, stepOrder: 1, approverId: "approver-1", action: null },
          { id: "aa-2", round: 1, stepOrder: 2, approverId: "approver-2", action: null },
        ],
      })
    );

    await approveForm("sub-1");

    expect(mockTx.formSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStep: 2 } })
    );
    expect(mockNotifyApproverOnSubmit).toHaveBeenCalledWith("sub-1", 2);
  });
});

// ─── rejectForm ───────────────────────────────────────────────

describe("rejectForm", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(rejectForm("sub-1")).rejects.toThrow("未登入");
  });

  it("表單非 PENDING 狀態應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(makeSubmission({ status: "REJECTED" }));
    await expect(rejectForm("sub-1")).rejects.toThrow("此表單不在簽核中");
  });

  it("不是當前關卡簽核者應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({
        approvalActions: [
          { id: "aa-1", round: 1, stepOrder: 1, approverId: "other", action: null },
        ],
      })
    );
    await expect(rejectForm("sub-1")).rejects.toThrow("你不是當前關卡的簽核者");
  });

  it("退件應更新狀態為 REJECTED 並通知申請人", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(makeSubmission());

    await rejectForm("sub-1", "不符規定");

    expect(mockTx.approvalAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REJECTED" }),
      })
    );
    expect(mockTx.formSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REJECTED" } })
    );
    expect(mockNotifyApplicantRejected).toHaveBeenCalledWith("sub-1", "不符規定");
  });
});

// ─── cancelSubmission ─────────────────────────────────────────

describe("cancelSubmission", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(cancelSubmission("sub-1")).rejects.toThrow("未登入");
  });

  it("不是自己的申請應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({ applicantId: "other-user" })
    );
    await expect(cancelSubmission("sub-1")).rejects.toThrow("只能取回自己的申請");
  });

  it("非 PENDING 狀態應拋出錯誤", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({ applicantId: "user-1", status: "APPROVED" })
    );
    await expect(cancelSubmission("sub-1")).rejects.toThrow("只有簽核中的表單可以取回");
  });

  it("合法取回應更新狀態為 REJECTED 並標記取回", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(
      makeSubmission({ applicantId: "user-1", status: "PENDING" })
    );

    await cancelSubmission("sub-1");

    expect(mockTx.formSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED", cancelledByApplicant: true }),
      })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/outbox");
  });
});

// ─── getInboxItems ────────────────────────────────────────────

describe("getInboxItems", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getInboxItems()).rejects.toThrow("未登入");
  });

  it("已登入應回傳待簽核、通知、已簽核", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const pendingAction = {
      id: "aa-1",
      stepOrder: 1,
      submission: { id: "sub-1", currentStep: 1, status: "PENDING" },
    };
    mockPrisma.approvalAction.findMany
      .mockResolvedValueOnce([pendingAction])   // allPendingApprovals
      .mockResolvedValueOnce([]);               // completedApprovals
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const result = await getInboxItems();

    expect(result.pendingApprovals).toHaveLength(1);
    expect(result.notifications).toEqual([]);
    expect(result.completedApprovals).toEqual([]);
  });

  it("stepOrder 不符當前關卡的 action 應被過濾", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const pendingAction = {
      id: "aa-2",
      stepOrder: 2,
      submission: { id: "sub-1", currentStep: 1, status: "PENDING" },
    };
    mockPrisma.approvalAction.findMany
      .mockResolvedValueOnce([pendingAction])
      .mockResolvedValueOnce([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const result = await getInboxItems();

    expect(result.pendingApprovals).toHaveLength(0);
  });
});

// ─── getOutboxItems ───────────────────────────────────────────

describe("getOutboxItems", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getOutboxItems()).rejects.toThrow("未登入");
  });

  it("已登入應回傳三種狀態的表單", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findMany
      .mockResolvedValueOnce([{ id: "sub-p" }])  // pending
      .mockResolvedValueOnce([{ id: "sub-a" }])  // approved
      .mockResolvedValueOnce([]);                 // rejected

    const result = await getOutboxItems();

    expect(result.pending).toHaveLength(1);
    expect(result.approved).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });
});

// ─── getSubmissionDetail ──────────────────────────────────────

describe("getSubmissionDetail", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getSubmissionDetail("sub-1")).rejects.toThrow("未登入");
  });

  it("已登入應回傳表單詳細資料", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const detail = { id: "sub-1", formType: "LEAVE", applicant: { name: "佑霖" } };
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue(detail);

    const result = await getSubmissionDetail("sub-1");

    expect(result).toEqual(detail);
  });
});
