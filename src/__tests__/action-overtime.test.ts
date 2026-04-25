import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireServerAuth = vi.hoisted(() => vi.fn());
const mockSafeZodParse = vi.hoisted(() => vi.fn());
const mockParseYearMonthItems = vi.hoisted(() => vi.fn());
const mockToDateOnly = vi.hoisted(() => vi.fn());
const mockRetryOnUniqueViolation = vi.hoisted(() => vi.fn());
const mockCreateWorkflowApprovalsAndNotify = vi.hoisted(() => vi.fn());
const mockCreateFormSubmission = vi.hoisted(() => vi.fn());
const mockAdvanceResubmit = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockCancelSubmission = vi.hoisted(() => vi.fn());
const mockUpsertAttachment = vi.hoisted(() => vi.fn());
const mockNotifyApproverOnSubmit = vi.hoisted(() => vi.fn());
const mockGetTaipeiDateStr = vi.hoisted(() => vi.fn());

const mockTx = {
  overtimeRequest: { create: vi.fn(), update: vi.fn() },
  overtimeItem: { deleteMany: vi.fn() },
};

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  overtimeRequest: { findFirst: vi.fn(), update: vi.fn() },
  workflowConfig: { findMany: vi.fn() },
  formSubmission: {
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/submission-helpers", () => ({
  requireServerAuth: mockRequireServerAuth,
  safeZodParse: mockSafeZodParse,
  parseYearMonthItems: mockParseYearMonthItems,
  toDateOnly: mockToDateOnly,
  retryOnUniqueViolation: mockRetryOnUniqueViolation,
  createWorkflowApprovalsAndNotify: mockCreateWorkflowApprovalsAndNotify,
  createFormSubmission: mockCreateFormSubmission,
  advanceResubmit: mockAdvanceResubmit,
}));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/actions/approval", () => ({ cancelSubmission: mockCancelSubmission }));
vi.mock("@/lib/attachment", () => ({ upsertAttachment: mockUpsertAttachment }));
vi.mock("@/lib/mailer", () => ({ notifyApproverOnSubmit: mockNotifyApproverOnSubmit }));
vi.mock("@/lib/form-number", () => ({ getTaipeiDateStr: mockGetTaipeiDateStr }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  submitOvertimeRequest,
  resubmitOvertimeRequest,
  cancelOvertimeRequest,
  deleteOvertimeRequest,
  getMyOvertimeRequests,
} from "@/actions/overtime";

const authedUser = { applicantId: "user-1", displayName: "佑霖" };

const parsedData = {
  year: 2026,
  month: 4,
  items: [
    {
      date: "2026-04-28",
      workerName: "佑霖",
      clientOrWork: "客戶A",
      dayType: "WEEKDAY",
      workTime: "18:00-20:00",
      workHours: 8,
      overtimeHours: 2,
      holidayDoublePay: 0,
      overtimePay: 400,
    },
  ],
};

function makeFormData() {
  const fd = new FormData();
  fd.append("year", "2026");
  fd.append("month", "4");
  fd.append("items", JSON.stringify(parsedData.items));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockToDateOnly.mockReturnValue(new Date("2026-04-27T16:00:00Z"));
  mockGetTaipeiDateStr.mockReturnValue("20260425");
  mockUpsertAttachment.mockResolvedValue(undefined);
  mockCreateWorkflowApprovalsAndNotify.mockResolvedValue(undefined);
  mockAdvanceResubmit.mockResolvedValue(undefined);
  mockNotifyApproverOnSubmit.mockResolvedValue(undefined);
  mockTx.overtimeRequest.create.mockResolvedValue({});
  mockTx.overtimeRequest.update.mockResolvedValue({});
  mockTx.overtimeItem.deleteMany.mockResolvedValue({});
});

// ─── submitOvertimeRequest ────────────────────────────────────

describe("submitOvertimeRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(submitOvertimeRequest(makeFormData())).rejects.toThrow("未登入");
  });

  it("同月已有進行中加班單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.overtimeRequest.findFirst.mockResolvedValue({ id: "existing" });

    await expect(submitOvertimeRequest(makeFormData())).rejects.toThrow("已有進行中");
  });

  it("無簽核流程應建立表單並回傳 id", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.overtimeRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);
    mockRetryOnUniqueViolation.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockCreateFormSubmission.mockResolvedValue({ sub: { id: "sub-1" }, formNumber: "OT-20260425-0001" });

    const result = await submitOvertimeRequest(makeFormData());

    expect(result).toEqual({ id: "sub-1" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overtime");
    expect(mockNotifyApproverOnSubmit).not.toHaveBeenCalled();
  });

  it("有簽核流程應通知簽核者", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.overtimeRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([{ stepOrder: 1, approverRole: "USER:mgr-1" }]);
    mockRetryOnUniqueViolation.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockCreateFormSubmission.mockResolvedValue({ sub: { id: "sub-2" }, formNumber: "OT-20260425-0002" });

    const result = await submitOvertimeRequest(makeFormData());

    expect(result).toEqual({ id: "sub-2" });
    expect(mockNotifyApproverOnSubmit).toHaveBeenCalledWith("sub-2");
  });
});

// ─── resubmitOvertimeRequest ──────────────────────────────────

describe("resubmitOvertimeRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(resubmitOvertimeRequest("sub-1", makeFormData())).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other",
      status: "REJECTED",
      overtimeRequest: { id: "ot-1" },
    });
    await expect(resubmitOvertimeRequest("sub-1", makeFormData())).rejects.toThrow("只能修改自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "PENDING",
      overtimeRequest: { id: "ot-1" },
    });
    await expect(resubmitOvertimeRequest("sub-1", makeFormData())).rejects.toThrow("只有被退件的表單可以重送");
  });

  it("無對應加班單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      overtimeRequest: null,
    });
    await expect(resubmitOvertimeRequest("sub-1", makeFormData())).rejects.toThrow("找不到對應的加班單");
  });

  it("合法重送應更新資料並 revalidate", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      overtimeRequest: { id: "ot-1" },
    });
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.overtimeRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);

    await resubmitOvertimeRequest("sub-1", makeFormData());

    expect(mockTx.overtimeItem.deleteMany).toHaveBeenCalled();
    expect(mockTx.overtimeRequest.update).toHaveBeenCalled();
    expect(mockAdvanceResubmit).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overtime");
  });
});

// ─── cancelOvertimeRequest ────────────────────────────────────

describe("cancelOvertimeRequest", () => {
  it("應呼叫 cancelSubmission 並 revalidate", async () => {
    mockCancelSubmission.mockResolvedValue(undefined);
    await cancelOvertimeRequest("sub-1");
    expect(mockCancelSubmission).toHaveBeenCalledWith("sub-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overtime");
  });
});

// ─── deleteOvertimeRequest ────────────────────────────────────

describe("deleteOvertimeRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(deleteOvertimeRequest("sub-1")).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other",
      status: "REJECTED",
      overtimeRequest: { id: "ot-1" },
    });
    await expect(deleteOvertimeRequest("sub-1")).rejects.toThrow("只能刪除自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "APPROVED",
      overtimeRequest: { id: "ot-1" },
    });
    await expect(deleteOvertimeRequest("sub-1")).rejects.toThrow("只有已退回/取消的表單可以刪除");
  });

  it("合法刪除應更新 deletedAt 並 revalidate", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      overtimeRequest: { id: "ot-1" },
    });
    mockPrisma.overtimeRequest.update.mockResolvedValue({});

    await deleteOvertimeRequest("sub-1");

    expect(mockPrisma.overtimeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ot-1" } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overtime");
  });
});

// ─── getMyOvertimeRequests ────────────────────────────────────

describe("getMyOvertimeRequests", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(getMyOvertimeRequests()).rejects.toThrow("未登入");
  });

  it("已登入應回傳加班單列表", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    const requests = [{ id: "sub-1", formType: "OVERTIME" }];
    mockPrisma.formSubmission.findMany.mockResolvedValue(requests);

    const result = await getMyOvertimeRequests();

    expect(result).toEqual(requests);
    expect(mockPrisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ applicantId: "user-1" }) })
    );
  });
});
