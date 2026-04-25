import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockCancelSubmission = vi.hoisted(() => vi.fn());
const mockUpsertAttachment = vi.hoisted(() => vi.fn());
const mockNotifyApprover = vi.hoisted(() => vi.fn());
const mockResolveWorkflowApprovers = vi.hoisted(() => vi.fn());

// tx mock（$transaction 內部使用）
const mockTx = {
  formSubmission: { create: vi.fn(), update: vi.fn() },
  leaveRequest: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  approvalAction: {
    create: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn().mockResolvedValue({ _max: { round: 0 } }),
  },
  notification: { create: vi.fn() },
};

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  leaveRequest: { findFirst: vi.fn(), update: vi.fn() },
  workflowConfig: { findMany: vi.fn() },
  leaveType: { findMany: vi.fn() },
  formSubmission: {
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/actions/approval", () => ({ cancelSubmission: mockCancelSubmission }));
vi.mock("@/lib/attachment", () => ({ upsertAttachment: mockUpsertAttachment }));
vi.mock("@/lib/mailer", () => ({ notifyApproverOnSubmit: mockNotifyApprover }));
vi.mock("@/lib/workflow", () => ({ resolveWorkflowApprovers: mockResolveWorkflowApprovers }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  submitLeaveRequest,
  resubmitLeaveRequest,
  cancelLeaveRequest,
  deleteLeaveRequest,
  getLeaveTypes,
  getMyLeaveRequests,
} from "@/actions/leave";

const authedSession = { user: { id: "user-1", email: "user@example.com", name: "佑霖" } };

function makeLeaveFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("leaveTypeId", overrides.leaveTypeId ?? "lt-1");
  fd.append("startDate", overrides.startDate ?? "2026-04-27");
  fd.append("startTime", overrides.startTime ?? "09:00");
  fd.append("endDate", overrides.endDate ?? "2026-04-27");
  fd.append("endTime", overrides.endTime ?? "17:00");
  fd.append("reason", overrides.reason ?? "休假");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.formSubmission.create.mockResolvedValue({ id: "sub-1" });
  mockTx.leaveRequest.create.mockResolvedValue({});
  mockTx.approvalAction.create.mockResolvedValue({});
  mockTx.notification.create.mockResolvedValue({});
  mockTx.approvalAction.findFirst.mockResolvedValue(null);
  mockUpsertAttachment.mockResolvedValue(undefined);
  mockResolveWorkflowApprovers.mockResolvedValue([]);
  mockNotifyApprover.mockResolvedValue(undefined);
});

// ─── submitLeaveRequest ───────────────────────────────────────

describe("submitLeaveRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(submitLeaveRequest(makeLeaveFormData())).rejects.toThrow("未登入");
  });

  it("表單驗證失敗應回傳 error", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const result = await submitLeaveRequest(makeLeaveFormData({ leaveTypeId: "" }));
    expect(result).toHaveProperty("error");
  });

  it("結束時間早於開始時間應回傳 error", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const fd = makeLeaveFormData({ startDate: "2026-04-27", startTime: "17:00", endDate: "2026-04-27", endTime: "09:00" });
    const result = await submitLeaveRequest(fd);
    expect(result).toHaveProperty("error");
  });

  it("與現有假單重疊應回傳 error", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.leaveRequest.findFirst.mockResolvedValue({ id: "existing" });
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);
    const result = await submitLeaveRequest(makeLeaveFormData());
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("重疊");
  });

  it("無簽核流程應直接建立 APPROVED 狀態表單並回傳 id", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.leaveRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);

    const result = await submitLeaveRequest(makeLeaveFormData());
    expect(result).toHaveProperty("id");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/leave");
  });

  it("有簽核流程應建立審核關卡並通知", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.leaveRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([{ stepOrder: 1, approverRole: "USER:mgr-1", formType: "LEAVE" }]);
    mockResolveWorkflowApprovers.mockResolvedValue([{ stepOrder: 1, approverId: "mgr-1" }]);
    mockTx.approvalAction.findFirst.mockResolvedValue({ approverId: "mgr-1" });

    const result = await submitLeaveRequest(makeLeaveFormData());
    expect(result).toHaveProperty("id");
    expect(mockTx.approvalAction.create).toHaveBeenCalled();
    expect(mockNotifyApprover).toHaveBeenCalled();
  });
});

// ─── resubmitLeaveRequest ─────────────────────────────────────

describe("resubmitLeaveRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(resubmitLeaveRequest("sub-1", makeLeaveFormData())).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({ applicantId: "other-user", status: "REJECTED" });
    await expect(resubmitLeaveRequest("sub-1", makeLeaveFormData())).rejects.toThrow("只能修改自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({ applicantId: "user-1", status: "PENDING" });
    await expect(resubmitLeaveRequest("sub-1", makeLeaveFormData())).rejects.toThrow("只有被退件的表單可以重送");
  });

  it("無重疊且無流程應成功重送", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({ applicantId: "user-1", status: "REJECTED" });
    mockPrisma.leaveRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);
    mockTx.leaveRequest.update.mockResolvedValue({});
    mockTx.formSubmission.update.mockResolvedValue({});

    await resubmitLeaveRequest("sub-1", makeLeaveFormData());
    expect(mockRevalidatePath).toHaveBeenCalledWith("/leave");
  });
});

// ─── cancelLeaveRequest ───────────────────────────────────────

describe("cancelLeaveRequest", () => {
  it("應呼叫 cancelSubmission 並 revalidate", async () => {
    mockCancelSubmission.mockResolvedValue(undefined);
    await cancelLeaveRequest("sub-1");
    expect(mockCancelSubmission).toHaveBeenCalledWith("sub-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/leave");
  });
});

// ─── deleteLeaveRequest ───────────────────────────────────────

describe("deleteLeaveRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(deleteLeaveRequest("sub-1")).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other-user", status: "REJECTED", leaveRequest: { id: "lr-1" },
    });
    await expect(deleteLeaveRequest("sub-1")).rejects.toThrow("只能刪除自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1", status: "APPROVED", leaveRequest: { id: "lr-1" },
    });
    await expect(deleteLeaveRequest("sub-1")).rejects.toThrow("只有已退回/取回的表單可以刪除");
  });

  it("合法刪除應更新 deletedAt 並 revalidate", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1", status: "REJECTED", leaveRequest: { id: "lr-1" },
    });
    mockPrisma.leaveRequest.update.mockResolvedValue({});

    await deleteLeaveRequest("sub-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/leave");
  });
});

// ─── getLeaveTypes ────────────────────────────────────────────

describe("getLeaveTypes", () => {
  it("應回傳假別清單", async () => {
    const types = [{ id: "lt-1", name: "特休" }];
    mockPrisma.leaveType.findMany.mockResolvedValue(types);
    const result = await getLeaveTypes();
    expect(result).toEqual(types);
  });
});

// ─── getMyLeaveRequests ───────────────────────────────────────

describe("getMyLeaveRequests", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getMyLeaveRequests()).rejects.toThrow("未登入");
  });

  it("已登入應回傳假單列表", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const submissions = [{ id: "sub-1", formType: "LEAVE" }];
    mockPrisma.formSubmission.findMany.mockResolvedValue(submissions);
    const result = await getMyLeaveRequests();
    expect(result).toEqual(submissions);
  });
});
