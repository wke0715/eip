import type { FormStatus, FormType } from "@prisma/client";

export type SubmissionLike = {
  id: string;
  formType: FormType;
  status: FormStatus;
  createdAt: Date | string;
  cancelledByApplicant?: boolean;
  applicant?: { name: string | null; email: string } | null;
  leaveRequest?: {
    formNumber: string;
    leaveType: { name: string };
    startDate: Date | string;
    endDate: Date | string;
    hours: number;
  } | null;
  expenseReport?: {
    formNumber: string;
    year: number;
    month: number;
    totalAmount: number;
  } | null;
  otherExpenseRequest?: {
    formNumber: string;
    year: number;
    month: number;
    totalAmount: number;
  } | null;
  overtimeRequest?: {
    formNumber: string;
    year: number;
    month: number;
    totalOvertimeHours: number;
  } | null;
};

export function formTypeLabel(sub: SubmissionLike): string {
  switch (sub.formType) {
    case "LEAVE":
      return `請假 - ${sub.leaveRequest?.leaveType.name ?? ""}`.trim();
    case "OVERTIME":
      return "加班";
    case "EXPENSE":
      return "出差旅費";
    case "OTHER_EXPENSE":
      return "其他費用";
    default:
      return sub.formType;
  }
}

export function formNumber(sub: SubmissionLike): string | null {
  switch (sub.formType) {
    case "LEAVE":
      return sub.leaveRequest?.formNumber ?? null;
    case "EXPENSE":
      return sub.expenseReport?.formNumber ?? null;
    case "OTHER_EXPENSE":
      return sub.otherExpenseRequest?.formNumber ?? null;
    case "OVERTIME":
      return sub.overtimeRequest?.formNumber ?? null;
    default:
      return null;
  }
}

function formatTwDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatYearMonth(year: number, month: number): string {
  return `${year} 年 ${month} 月`;
}

export function formPeriod(sub: SubmissionLike): string {
  switch (sub.formType) {
    case "LEAVE": {
      if (!sub.leaveRequest) return "-";
      return `${formatTwDate(sub.leaveRequest.startDate)} ~ ${formatTwDate(sub.leaveRequest.endDate)}`;
    }
    case "EXPENSE":
      return sub.expenseReport
        ? formatYearMonth(sub.expenseReport.year, sub.expenseReport.month)
        : "-";
    case "OTHER_EXPENSE":
      return sub.otherExpenseRequest
        ? formatYearMonth(sub.otherExpenseRequest.year, sub.otherExpenseRequest.month)
        : "-";
    case "OVERTIME":
      return sub.overtimeRequest
        ? formatYearMonth(sub.overtimeRequest.year, sub.overtimeRequest.month)
        : "-";
    default:
      return "-";
  }
}

function formatHours(hours: number): string {
  return `${hours} 小時`;
}

function formatAmount(amount: number): string {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}

export function formAmountOrHours(sub: SubmissionLike): string {
  switch (sub.formType) {
    case "LEAVE":
      return sub.leaveRequest ? formatHours(sub.leaveRequest.hours) : "-";
    case "OVERTIME":
      return sub.overtimeRequest
        ? formatHours(sub.overtimeRequest.totalOvertimeHours)
        : "-";
    case "EXPENSE":
      return sub.expenseReport ? formatAmount(sub.expenseReport.totalAmount) : "-";
    case "OTHER_EXPENSE":
      return sub.otherExpenseRequest
        ? formatAmount(sub.otherExpenseRequest.totalAmount)
        : "-";
    default:
      return "-";
  }
}

export function applicantDisplay(sub: SubmissionLike): string {
  if (!sub.applicant) return "-";
  return sub.applicant.name ?? sub.applicant.email;
}
