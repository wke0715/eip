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
  expenseReport: { create: vi.fn(), update: vi.fn() },
  expenseReportItem: { deleteMany: vi.fn() },
};

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  expenseReport: { findFirst: vi.fn(), update: vi.fn() },
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
  submitExpenseReport,
  resubmitExpenseReport,
  cancelExpenseReport,
  deleteExpenseReport,
  getMyExpenseReports,
} from "@/actions/expense";

const authedUser = { applicantId: "user-1", displayName: "佑霖" };

const parsedData = {
  year: 2026,
  month: 4,
  items: [
    {
      date: "2026-04-25",
      days: 1,
      workCategory: "A",
      workDetail: "客戶拜訪",
      mileageSubsidy: 0,
      parkingFee: 0,
      etcFee: 0,
      gasFee: 0,
      transportType: null,
      transportAmount: 0,
      mealType: null,
      mealAmount: 0,
      otherKind: null,
      otherName: null,
      otherAmount: 0,
      subtotal: 100,
      receipts: 1,
      remark: null,
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
  mockTx.expenseReport.create.mockResolvedValue({});
  mockTx.expenseReport.update.mockResolvedValue({});
  mockTx.expenseReportItem.deleteMany.mockResolvedValue({});
});

// ─── submitExpenseReport ──────────────────────────────────────

describe("submitExpenseReport", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(submitExpenseReport(makeFormData())).rejects.toThrow("未登入");
  });

  it("同月已有進行中報告應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.expenseReport.findFirst.mockResolvedValue({ id: "existing" });

    await expect(submitExpenseReport(makeFormData())).rejects.toThrow("已有進行中");
  });

  it("無簽核流程應建立 APPROVED 表單並回傳 id", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.expenseReport.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);
    mockRetryOnUniqueViolation.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockCreateFormSubmission.mockResolvedValue({ sub: { id: "sub-1" }, formNumber: "EX-20260425-0001" });

    const result = await submitExpenseReport(makeFormData());

    expect(result).toEqual({ id: "sub-1" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/expense");
    expect(mockNotifyApproverOnSubmit).not.toHaveBeenCalled();
  });

  it("有簽核流程應建立 PENDING 表單並呼叫通知", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.expenseReport.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([{ stepOrder: 1, approverRole: "USER:mgr-1", formType: "EXPENSE" }]);
    mockRetryOnUniqueViolation.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    mockCreateFormSubmission.mockResolvedValue({ sub: { id: "sub-2" }, formNumber: "EX-20260425-0002" });

    const result = await submitExpenseReport(makeFormData());

    expect(result).toEqual({ id: "sub-2" });
    expect(mockCreateWorkflowApprovalsAndNotify).toHaveBeenCalled();
    expect(mockNotifyApproverOnSubmit).toHaveBeenCalledWith("sub-2");
  });
});

// ─── resubmitExpenseReport ────────────────────────────────────

describe("resubmitExpenseReport", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(resubmitExpenseReport("sub-1", makeFormData())).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other-user",
      status: "REJECTED",
      expenseReport: { id: "er-1" },
    });
    await expect(resubmitExpenseReport("sub-1", makeFormData())).rejects.toThrow("只能修改自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "PENDING",
      expenseReport: { id: "er-1" },
    });
    await expect(resubmitExpenseReport("sub-1", makeFormData())).rejects.toThrow("只有被退件的表單可以重送");
  });

  it("無對應報告單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      expenseReport: null,
    });
    await expect(resubmitExpenseReport("sub-1", makeFormData())).rejects.toThrow("找不到對應的報告單");
  });

  it("合法重送應更新資料並 revalidate", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      expenseReport: { id: "er-1" },
    });
    mockParseYearMonthItems.mockReturnValue({ year: 2026, month: 4, items: [] });
    mockSafeZodParse.mockReturnValue(parsedData);
    mockPrisma.expenseReport.findFirst.mockResolvedValue(null);
    mockPrisma.workflowConfig.findMany.mockResolvedValue([]);

    await resubmitExpenseReport("sub-1", makeFormData());

    expect(mockTx.expenseReportItem.deleteMany).toHaveBeenCalled();
    expect(mockTx.expenseReport.update).toHaveBeenCalled();
    expect(mockAdvanceResubmit).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/expense");
  });
});

// ─── cancelExpenseReport ──────────────────────────────────────

describe("cancelExpenseReport", () => {
  it("應呼叫 cancelSubmission 並 revalidate", async () => {
    mockCancelSubmission.mockResolvedValue(undefined);
    await cancelExpenseReport("sub-1");
    expect(mockCancelSubmission).toHaveBeenCalledWith("sub-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/expense");
  });
});

// ─── deleteExpenseReport ──────────────────────────────────────

describe("deleteExpenseReport", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(deleteExpenseReport("sub-1")).rejects.toThrow("未登入");
  });

  it("不是自己的表單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "other-user",
      status: "REJECTED",
      expenseReport: { id: "er-1" },
    });
    await expect(deleteExpenseReport("sub-1")).rejects.toThrow("只能刪除自己的申請");
  });

  it("非退件狀態應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "APPROVED",
      expenseReport: { id: "er-1" },
    });
    await expect(deleteExpenseReport("sub-1")).rejects.toThrow("只有已退回/取消的表單可以刪除");
  });

  it("無對應報告單應拋出錯誤", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      expenseReport: null,
    });
    await expect(deleteExpenseReport("sub-1")).rejects.toThrow("找不到對應的報告單");
  });

  it("合法刪除應更新 deletedAt 並 revalidate", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      applicantId: "user-1",
      status: "REJECTED",
      expenseReport: { id: "er-1" },
    });
    mockPrisma.expenseReport.update.mockResolvedValue({});

    await deleteExpenseReport("sub-1");

    expect(mockPrisma.expenseReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "er-1" } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/expense");
  });
});

// ─── getMyExpenseReports ──────────────────────────────────────

describe("getMyExpenseReports", () => {
  it("未登入應拋出錯誤", async () => {
    mockRequireServerAuth.mockRejectedValue(new Error("未登入"));
    await expect(getMyExpenseReports()).rejects.toThrow("未登入");
  });

  it("已登入應回傳報告列表", async () => {
    mockRequireServerAuth.mockResolvedValue(authedUser);
    const reports = [{ id: "sub-1", formType: "EXPENSE" }];
    mockPrisma.formSubmission.findMany.mockResolvedValue(reports);

    const result = await getMyExpenseReports();

    expect(result).toEqual(reports);
    expect(mockPrisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ applicantId: "user-1" }) })
    );
  });
});
