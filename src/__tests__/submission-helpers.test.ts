import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { z } from "zod";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/workflow", () => ({ resolveWorkflowApprovers: vi.fn() }));
vi.mock("@/lib/form-number", () => ({ generateFormNumber: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  parseItemsJson,
  toDateOnly,
  toDateStr,
  mapExpenseItems,
  parseYearMonthItems,
  safeZodParse,
  retryOnUniqueViolation,
  requireServerAuth,
  createWorkflowApprovalsAndNotify,
  createFormSubmission,
  advanceResubmit,
} from "@/lib/submission-helpers";

import { auth } from "@/lib/auth";
const mockAuth = vi.mocked(auth);

import { resolveWorkflowApprovers } from "@/lib/workflow";
import { generateFormNumber } from "@/lib/form-number";

const mockResolveWorkflowApprovers = vi.mocked(resolveWorkflowApprovers);
const mockGenerateFormNumber = vi.mocked(generateFormNumber);

// ─── parseItemsJson ───────────────────────────────────────────

describe("parseItemsJson", () => {
  it("null 應回傳空陣列", () => {
    expect(parseItemsJson(null)).toEqual([]);
  });

  it("空字串應回傳空陣列", () => {
    expect(parseItemsJson("")).toEqual([]);
  });

  it("只有空白字元應回傳空陣列", () => {
    expect(parseItemsJson("   ")).toEqual([]);
  });

  it("合法 JSON 陣列應解析成功", () => {
    expect(parseItemsJson('[{"id":1},{"id":2}]')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("非法 JSON 應拋出「明細資料格式錯誤」", () => {
    expect(() => parseItemsJson("not-json")).toThrow("明細資料格式錯誤");
  });
});

// ─── toDateOnly & toDateStr ───────────────────────────────────

describe("toDateOnly", () => {
  it("日期字串應轉為台北時間午夜的 Date 物件", () => {
    const d = toDateOnly("2026-04-25");
    // 台北 +08:00 午夜 = UTC 16:00 前一天
    expect(d.toISOString()).toBe("2026-04-24T16:00:00.000Z");
  });
});

describe("toDateStr", () => {
  it("UTC Date 應轉回台北日期字串", () => {
    // 2026-04-24T16:00:00Z = 台北 2026-04-25T00:00:00
    const d = new Date("2026-04-24T16:00:00Z");
    expect(toDateStr(d)).toBe("2026-04-25");
  });

  it("toDateOnly → toDateStr 應形成 round-trip", () => {
    expect(toDateStr(toDateOnly("2026-04-25"))).toBe("2026-04-25");
  });
});

// ─── mapExpenseItems ──────────────────────────────────────────

describe("mapExpenseItems", () => {
  it("應正確映射 DB 欄位到 ExpenseItemInput", () => {
    const dbItem = {
      date: new Date("2026-04-24T16:00:00Z"), // 台北 2026-04-25
      days: 1,
      workCategory: "C",
      workDetail: "客戶_ABC",
      mileageSubsidy: 100,
      parkingFee: 50,
      etcFee: 30,
      gasFee: 0,
      transportType: "T",
      transportAmount: 200,
      mealType: "B",
      mealAmount: 80,
      otherKind: null,
      otherName: null,
      otherAmount: 0,
      subtotal: 460,
      receipts: 2,
      remark: "備註",
    };

    const [mapped] = mapExpenseItems([dbItem]);

    expect(mapped.date).toBe("2026-04-25");
    expect(mapped.days).toBe(1);
    expect(mapped.workCategory).toBe("C");
    expect(mapped.mileageSubsidy).toBe(100);
    expect(mapped.transportType).toBe("T");
    expect(mapped.mealType).toBe("B");
    expect(mapped.remark).toBe("備註");
  });

  it("空陣列應回傳空陣列", () => {
    expect(mapExpenseItems([])).toEqual([]);
  });
});

// ─── parseYearMonthItems ──────────────────────────────────────

describe("parseYearMonthItems", () => {
  it("應從 FormData 解析 year、month 和 items", () => {
    const fd = new FormData();
    fd.append("year", "2026");
    fd.append("month", "4");
    fd.append("items", '[{"id":1}]');

    const result = parseYearMonthItems(fd);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(4);
    expect(result.items).toEqual([{ id: 1 }]);
  });
});

// ─── safeZodParse ─────────────────────────────────────────────

describe("safeZodParse", () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it("合法資料應回傳解析結果", () => {
    expect(safeZodParse(schema, { name: "佑霖", age: 30 })).toEqual({
      name: "佑霖",
      age: 30,
    });
  });

  it("非法資料應拋出 Error（含 Zod 錯誤訊息）", () => {
    expect(() => safeZodParse(schema, { name: 123, age: "abc" })).toThrow(Error);
  });

  it("非 ZodError 應直接重拋原始錯誤", () => {
    const fakeSchema = {
      parse: () => { throw new TypeError("not a zod error"); },
    } as unknown as z.ZodSchema<unknown>;
    expect(() => safeZodParse(fakeSchema, {})).toThrow(TypeError);
  });
});

// ─── retryOnUniqueViolation ───────────────────────────────────

describe("retryOnUniqueViolation", () => {
  it("第一次成功應直接回傳結果", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryOnUniqueViolation(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("非 P2002 錯誤應立即拋出，不重試", async () => {
    const err = new Error("其他錯誤");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(retryOnUniqueViolation(fn, 5)).rejects.toThrow("其他錯誤");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("P2002 衝突後成功應重試並回傳結果", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "6.0.0",
    });
    const fn = vi.fn()
      .mockRejectedValueOnce(p2002)
      .mockResolvedValue("retry-ok");

    const result = await retryOnUniqueViolation(fn, 3);
    expect(result).toBe("retry-ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("超過 maxAttempts 仍衝突應最終拋出", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "6.0.0",
    });
    const fn = vi.fn().mockRejectedValue(p2002);
    await expect(retryOnUniqueViolation(fn, 3)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("maxAttempts=0 迴圈不執行應拋出 unreachable", async () => {
    const fn = vi.fn();
    await expect(retryOnUniqueViolation(fn, 0)).rejects.toThrow("unreachable");
    expect(fn).not.toHaveBeenCalled();
  });
});

// ─── requireServerAuth ────────────────────────────────────────

describe("requireServerAuth", () => {
  it("session 為 null 應拋出「未登入」", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(requireServerAuth()).rejects.toThrow("未登入");
  });

  it("session 無 user.id 應拋出「未登入」", async () => {
    mockAuth.mockResolvedValue({ user: {}, expires: "2099" } as never);
    await expect(requireServerAuth()).rejects.toThrow("未登入");
  });

  it("有效 session 應回傳 applicantId 與 displayName（name 優先）", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", name: "佑霖", email: "wke@example.com" },
      expires: "2099",
    } as never);
    const result = await requireServerAuth();
    expect(result.applicantId).toBe("user-1");
    expect(result.displayName).toBe("佑霖");
  });

  it("name 為 null 時退到 email", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-2", name: null, email: "wke@example.com" },
      expires: "2099",
    } as never);
    const result = await requireServerAuth();
    expect(result.displayName).toBe("wke@example.com");
  });
});

// ─── createWorkflowApprovalsAndNotify ─────────────────────────

describe("createWorkflowApprovalsAndNotify", () => {
  function makeTx() {
    return {
      approvalAction: {
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ approverId: "approver-1" }),
      },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };
  }

  it("steps 為空且無 notification 不應建立任何資料", async () => {
    mockResolveWorkflowApprovers.mockResolvedValue([]);
    const tx = makeTx();
    await createWorkflowApprovalsAndNotify(tx as never, {
      submissionId: "sub-1",
      applicantId: "user-1",
      workflowSteps: [],
    });
    expect(tx.approvalAction.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("有審核者應建立 ApprovalAction", async () => {
    mockResolveWorkflowApprovers.mockResolvedValue([
      { stepOrder: 1, approverId: "approver-1" },
    ]);
    const tx = makeTx();
    await createWorkflowApprovalsAndNotify(tx as never, {
      submissionId: "sub-1",
      applicantId: "user-1",
      workflowSteps: [{ stepOrder: 1, approverRole: "USER:approver-1" }],
    });
    expect(tx.approvalAction.create).toHaveBeenCalledTimes(1);
  });

  it("有 notification 應建立通知", async () => {
    mockResolveWorkflowApprovers.mockResolvedValue([
      { stepOrder: 1, approverId: "approver-1" },
    ]);
    const tx = makeTx();
    await createWorkflowApprovalsAndNotify(tx as never, {
      submissionId: "sub-1",
      applicantId: "user-1",
      workflowSteps: [{ stepOrder: 1, approverRole: "USER:approver-1" }],
      notification: { title: "待審核", message: "請假單等待審核" },
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });
});

// ─── createFormSubmission ─────────────────────────────────────

describe("createFormSubmission", () => {
  it("有流程步驟應建立 PENDING 狀態的表單", async () => {
    const mockSub = { id: "sub-1", status: "PENDING" };
    const tx = {
      formSubmission: { create: vi.fn().mockResolvedValue(mockSub) },
    };
    mockGenerateFormNumber.mockResolvedValue("LV-20260425-0001");

    const result = await createFormSubmission(tx as never, {
      formType: "LEAVE",
      applicantId: "user-1",
      workflowSteps: [{ stepOrder: 1 }],
      dateStr: "20260425",
    });

    expect(tx.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) })
    );
    expect(result.formNumber).toBe("LV-20260425-0001");
  });

  it("無流程步驟應建立 APPROVED 狀態的表單", async () => {
    const tx = {
      formSubmission: { create: vi.fn().mockResolvedValue({ id: "sub-2" }) },
    };
    mockGenerateFormNumber.mockResolvedValue("LV-20260425-0002");

    await createFormSubmission(tx as never, {
      formType: "LEAVE",
      applicantId: "user-1",
      workflowSteps: [],
      dateStr: "20260425",
    });

    expect(tx.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
    );
  });
});

// ─── advanceResubmit ──────────────────────────────────────────

describe("advanceResubmit", () => {
  it("應更新表單狀態並建立新一輪審核", async () => {
    mockResolveWorkflowApprovers.mockResolvedValue([
      { stepOrder: 1, approverId: "approver-1" },
    ]);
    const tx = {
      approvalAction: {
        aggregate: vi.fn().mockResolvedValue({ _max: { round: 1 } }),
        create: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ approverId: "approver-1" }),
      },
      formSubmission: { update: vi.fn().mockResolvedValue({}) },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };

    await advanceResubmit(tx as never, {
      submissionId: "sub-1",
      applicantId: "user-1",
      workflowSteps: [{ stepOrder: 1, approverRole: "USER:approver-1" }],
      notification: { title: "重送審核", message: "表單已重送" },
    });

    expect(tx.formSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sub-1" } })
    );
    expect(tx.approvalAction.create).toHaveBeenCalled();
  });
});
