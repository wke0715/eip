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
  otherExpenseRequest: { create: vi.fn(), update: vi.fn() },
  otherExpenseItem: { deleteMany: vi.fn() },
};

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  otherExpenseRequest: { findFirst: vi.fn(), update: vi.fn() },
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
  submitOtherExpenseRequest,
  resubmitOtherExpenseRequest,
  cancelOtherExpenseRequest,
  deleteOtherExpenseRequest,
  getMyOtherExpenseRequests,
} from "@/actions/otherExpense";

const authedUser = { applicantId: "user-1", displayName: "佑霖" };

const parsedData = {
  year: 2026,
  month: 4,
  items: [
    {
      date: "2026-04-25",
      itemName: "辦公用品",
      purpose: "日常使用",
      quantity: 2,
      unitPrice: 50,
      subtotal: 100,
      receipts: 1,
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
  mockToDateOnly.mockReturnValue(new Date("2026-04-24T16:00:00Z"));
  mockGetTaipeiDateStr.mockReturnValue("20260425");
  mockUpsertAttachment.mockResolvedValue(undefined);
  mockCreateWorkflowApprovalsAndNotify.mockResolvedValue(undefined);
  mockAdvanceResubmit.mockResolvedValue(undefined);
  mockNotifyApproverOnSubmit.mockResolvedValue(undefined);
  mockTx.otherExpenseRequest.create.mockResolvedValue({});
  mockTx.otherExpenseRequest.update.mockResolvedValue({});
  mockTx.otherExpenseItem.deleteMany.mockResolvedValue({});
});

// ─── submitOtherExpenseRequest ────────────────────────────────

describe("submitOtherExpenseRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(submitOtherExpenseRequest(makeFormData())).rejects.toThrow("未登入");
  });

  it("同月已有進行中申請應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.otherExpenseRequest.findFirst.mockResolvedValue({ id: "existing" });

    await expect(submitOtherExpenseRequest(makeFormData())).rejects.toThrow("已有進行中");
  });

  it("無簽核流程應建立表單並回傳 id", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.otherExpenseRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);
    mockRetryOnUniqueViolation.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockCreateFormSubmission.mockResolvedValue({ sub: { id: "sub-1" }, formNumber: "OE-20260425-0001" });

    const result = await submitOtherExpenseRequest(makeFormData());

    expect(result).toEqual({ id: "sub-1" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/other-expense");
    expect(mockNotifyApproverOnSubmit).not.toHaveBeenCalled();
  });

  it("有簽核流程應建立並通知", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.otherExpenseRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([{ stepOrder: 1, approverRole: "USER:mgr-1" }]);
    mockRetryOnUniqueViolation.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockCreateFormSubmission.mockResolvedValue({ sub: { id: "sub-2" }, formNumber: "OE-20260425-0002" });

    const result = await submitOtherExpenseRequest(makeFormData());

    expect(result).toEqual({ id: "sub-2" });
    expect(mockCreateWorkflowApprovalsAndNotify).toHaveBeenCalled();
    expect(mockNotifyApproverOnSubmit).toHaveBeenCalledWith("sub-2");
  });
});

// ─── resubmitOtherExpenseRequest ──────────────────────────────

describe("resubmitOtherExpenseRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(resubmitOtherExpenseRequest("sub-1", makeFormData())).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other",
      status: "REJECTED",
      otherExpenseRequest: { id: "oe-1" },
    });
    await expect(resubmitOtherExpenseRequest("sub-1", makeFormData())).rejects.toThrow("只能修改自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "PENDING",
      otherExpenseRequest: { id: "oe-1" },
    });
    await expect(resubmitOtherExpenseRequest("sub-1", makeFormData())).rejects.toThrow("只有被退件的表單可以重送");
  });

  it("無對應申請單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      otherExpenseRequest: null,
    });
    await expect(resubmitOtherExpenseRequest("sub-1", makeFormData())).rejects.toThrow("找不到對應的申請單");
  });

  it("合法重送應更新資料並 revalidate", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      otherExpenseRequest: { id: "oe-1" },
    });
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.otherExpenseRequest.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);

    await resubmitOtherExpenseRequest("sub-1", makeFormData());

    expect(mockTx.otherExpenseItem.deleteMany).toHaveBeenCalled();
    expect(mockTx.otherExpenseRequest.update).toHaveBeenCalled();
    expect(mockAdvanceResubmit).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/other-expense");
  });
});

// ─── cancelOtherExpenseRequest ────────────────────────────────

describe("cancelOtherExpenseRequest", () => {
  it("應呼叫 cancelSubmission 並 revalidate", async () => {
    mockCancelSubmission.mockResolvedValue(undefined);
    await cancelOtherExpenseRequest("sub-1");
    expect(mockCancelSubmission).toHaveBeenCalledWith("sub-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/other-expense");
  });
});

// ─── deleteOtherExpenseRequest ────────────────────────────────

describe("deleteOtherExpenseRequest", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(deleteOtherExpenseRequest("sub-1")).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other",
      status: "REJECTED",
      otherExpenseRequest: { id: "oe-1" },
    });
    await expect(deleteOtherExpenseRequest("sub-1")).rejects.toThrow("只能刪除自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "APPROVED",
      otherExpenseRequest: { id: "oe-1" },
    });
    await expect(deleteOtherExpenseRequest("sub-1")).rejects.toThrow("只有已退回/取消的表單可以刪除");
  });

  it("合法刪除應更新 deletedAt 並 revalidate", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      otherExpenseRequest: { id: "oe-1" },
    });
    mockPrisma.otherExpenseRequest.update.mockResolvedValue({});

    await deleteOtherExpenseRequest("sub-1");

    expect(mockPrisma.otherExpenseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "oe-1" } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/other-expense");
  });
});

// ─── getMyOtherExpenseRequests ────────────────────────────────

describe("getMyOtherExpenseRequests", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(getMyOtherExpenseRequests()).rejects.toThrow("未登入");
  });

  it("已登入應回傳申請列表", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    const requests = [{ id: "sub-1", formType: "OTHER_EXPENSE" }];
    mockPrisma.formSubmission.findMany.mockResolvedValue(requests);

    const result = await getMyOtherExpenseRequests();

    expect(result).toEqual(requests);
    expect(mockPrisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ applicantId: "user-1" }) })
    );
  });
});
