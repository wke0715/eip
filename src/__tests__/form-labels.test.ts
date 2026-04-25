import { describe, it, expect } from "vitest";
import {
  applicantDisplay,
  formAmountOrHours,
  formNumber,
  formPeriod,
  formTypeLabel,
  type SubmissionLike,
} from "@/lib/form-labels";

function tw(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

const leave: SubmissionLike = {
  id: "s1",
  formType: "LEAVE",
  status: "PENDING",
  createdAt: tw("2026-04-18"),
  leaveRequest: {
    formNumber: "LV-2026-0001",
    leaveType: { name: "特休" },
    startDate: tw("2026-04-20"),
    endDate: tw("2026-04-22"),
    hours: 16,
  },
};

const overtime: SubmissionLike = {
  id: "s2",
  formType: "OVERTIME",
  status: "APPROVED",
  createdAt: tw("2026-04-10"),
  overtimeRequest: {
    formNumber: "OT-2026-04-0003",
    year: 2026,
    month: 4,
    totalOvertimeHours: 12.5,
  },
};

const expense: SubmissionLike = {
  id: "s3",
  formType: "EXPENSE",
  status: "PENDING",
  createdAt: tw("2026-04-15"),
  expenseReport: {
    formNumber: "EX-2026-04-0001",
    year: 2026,
    month: 4,
    totalAmount: 12345,
  },
};

const otherExpense: SubmissionLike = {
  id: "s4",
  formType: "OTHER_EXPENSE",
  status: "REJECTED",
  cancelledByApplicant: true,
  createdAt: tw("2026-04-12"),
  otherExpenseRequest: {
    formNumber: "OE-2026-04-0002",
    year: 2026,
    month: 4,
    totalAmount: 800,
  },
};

describe("formTypeLabel", () => {
  it("LEAVE 帶假別名稱", () => {
    expect(formTypeLabel(leave)).toBe("請假 - 特休");
  });
  it("OVERTIME 顯示「加班」", () => {
    expect(formTypeLabel(overtime)).toBe("加班");
  });
  it("EXPENSE 顯示「出差旅費」", () => {
    expect(formTypeLabel(expense)).toBe("出差旅費");
  });
  it("OTHER_EXPENSE 顯示「其他費用」", () => {
    expect(formTypeLabel(otherExpense)).toBe("其他費用");
  });
  it("LEAVE 沒帶 leaveRequest 只顯示「請假 -」不炸", () => {
    expect(formTypeLabel({ ...leave, leaveRequest: null })).toBe("請假 -");
  });
  it("未知 formType 回傳 formType 原始值", () => {
    const unknown = { ...leave, formType: "UNKNOWN" } as unknown as SubmissionLike;
    expect(formTypeLabel(unknown)).toBe("UNKNOWN");
  });
});

describe("formNumber", () => {
  it("四種表單各自取對應 formNumber", () => {
    expect(formNumber(leave)).toBe("LV-2026-0001");
    expect(formNumber(overtime)).toBe("OT-2026-04-0003");
    expect(formNumber(expense)).toBe("EX-2026-04-0001");
    expect(formNumber(otherExpense)).toBe("OE-2026-04-0002");
  });
  it("關聯缺失回傳 null", () => {
    expect(formNumber({ ...leave, leaveRequest: null })).toBeNull();
  });
  it("未知 formType 回傳 null", () => {
    const unknown = { ...leave, formType: "UNKNOWN" } as unknown as SubmissionLike;
    expect(formNumber(unknown)).toBeNull();
  });
});

describe("formPeriod", () => {
  it("LEAVE 顯示起訖日期（zh-TW）", () => {
    expect(formPeriod(leave)).toBe("2026/04/20 ~ 2026/04/22");
  });
  it("OVERTIME/EXPENSE/OTHER_EXPENSE 顯示年月", () => {
    expect(formPeriod(overtime)).toBe("2026 年 4 月");
    expect(formPeriod(expense)).toBe("2026 年 4 月");
    expect(formPeriod(otherExpense)).toBe("2026 年 4 月");
  });
  it("關聯缺失回傳「-」", () => {
    expect(formPeriod({ ...leave, leaveRequest: null })).toBe("-");
  });
  it("未知 formType 回傳「-」", () => {
    const unknown = { ...leave, formType: "UNKNOWN" } as unknown as SubmissionLike;
    expect(formPeriod(unknown)).toBe("-");
  });
});

describe("formAmountOrHours", () => {
  it("LEAVE 顯示時數", () => {
    expect(formAmountOrHours(leave)).toBe("16 小時");
  });
  it("OVERTIME 顯示 totalOvertimeHours", () => {
    expect(formAmountOrHours(overtime)).toBe("12.5 小時");
  });
  it("EXPENSE 顯示金額（千分位）", () => {
    expect(formAmountOrHours(expense)).toBe("NT$ 12,345");
  });
  it("OTHER_EXPENSE 顯示金額", () => {
    expect(formAmountOrHours(otherExpense)).toBe("NT$ 800");
  });
  it("未知 formType 回傳「-」", () => {
    const unknown = { ...leave, formType: "UNKNOWN" } as unknown as SubmissionLike;
    expect(formAmountOrHours(unknown)).toBe("-");
  });
});

describe("applicantDisplay", () => {
  it("有 name 用 name", () => {
    const withName: SubmissionLike = {
      ...leave,
      applicant: { name: "佑霖", email: "wke0715@gmail.com" },
    };
    expect(applicantDisplay(withName)).toBe("佑霖");
  });
  it("name=null 退到 email", () => {
    const noName: SubmissionLike = {
      ...leave,
      applicant: { name: null, email: "wke0715@gmail.com" },
    };
    expect(applicantDisplay(noName)).toBe("wke0715@gmail.com");
  });
  it("沒 applicant 回「-」", () => {
    expect(applicantDisplay(leave)).toBe("-");
  });
});
