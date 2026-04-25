import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendViaGmail = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  smtpConfig: { findFirst: vi.fn() },
  approvalAction: { findFirst: vi.fn() },
  formSubmission: { findUniqueOrThrow: vi.fn() },
}));

vi.mock("@/lib/gmail", () => ({ sendViaGmail: mockSendViaGmail }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  sendMeetingBookingMail,
  sendMeetingCancelMail,
  notifyApproverOnSubmit,
  notifyApplicantApproved,
  notifyApplicantRejected,
} from "@/lib/mailer";

const baseBookingInput = {
  bookingId: "b-1",
  subject: "週會",
  date: new Date("2026-04-27T00:00:00Z"),
  startTime: "09:00",
  endTime: "10:00",
  roomName: "大會議室",
  roomLocation: "3F",
  booker: { name: "佑霖", email: "booker@example.com" },
  attendees: [{ name: "小明", email: "ming@example.com" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GMAIL_USER = "eip@gmail.com";
  mockPrisma.smtpConfig.findFirst.mockResolvedValue({ senderName: "企盉 EIP", isActive: true });
  mockSendViaGmail.mockResolvedValue(undefined);
});

// ─── sendMeetingBookingMail ───────────────────────────────────

describe("sendMeetingBookingMail", () => {
  it("無收件人應直接返回（不寄信）", async () => {
    const result = await sendMeetingBookingMail({
      ...baseBookingInput,
      booker: { name: null, email: "" },
      attendees: [],
    });
    expect(result).toBeUndefined();
    expect(mockSendViaGmail).not.toHaveBeenCalled();
  });

  it("有收件人應呼叫 sendViaGmail 並回傳 recipientEmails", async () => {
    const result = await sendMeetingBookingMail(baseBookingInput);

    expect(mockSendViaGmail).toHaveBeenCalledOnce();
    const callArgs = mockSendViaGmail.mock.calls[0][0];
    expect(callArgs.to).toContain("booker@example.com");
    expect(callArgs.subject).toContain("週會");
    expect(result?.recipientEmails).toContain("booker@example.com");
  });

  it("重複 email 應只寄一封（去重）", async () => {
    const result = await sendMeetingBookingMail({
      ...baseBookingInput,
      attendees: [{ name: "小明", email: "booker@example.com" }],
    });

    expect(result?.recipientEmails).toHaveLength(1);
    expect(result?.recipientEmails[0]).toBe("booker@example.com");
  });

  it("無 location 應只顯示房間名稱", async () => {
    await sendMeetingBookingMail({ ...baseBookingInput, roomLocation: null });

    const callArgs = mockSendViaGmail.mock.calls[0][0];
    expect(callArgs.text).toContain("大會議室");
    expect(callArgs.text).not.toContain("（3F）");
  });

  it("未設定 GMAIL_USER 應拋出錯誤", async () => {
    delete process.env.GMAIL_USER;
    await expect(sendMeetingBookingMail(baseBookingInput)).rejects.toThrow("未設定 GMAIL_USER");
  });
});

// ─── sendMeetingCancelMail ────────────────────────────────────

describe("sendMeetingCancelMail", () => {
  it("無收件人應直接返回", async () => {
    const result = await sendMeetingCancelMail({
      ...baseBookingInput,
      booker: { name: null, email: "" },
      attendees: [],
      cancelledBy: { name: "Admin", email: "admin@example.com" },
      cancelledByAdmin: true,
    });
    expect(result).toBeUndefined();
    expect(mockSendViaGmail).not.toHaveBeenCalled();
  });

  it("管理員取消應在主旨標示已取消", async () => {
    await sendMeetingCancelMail({
      ...baseBookingInput,
      cancelledBy: { name: "Admin", email: "admin@example.com" },
      cancelledByAdmin: true,
    });

    const callArgs = mockSendViaGmail.mock.calls[0][0];
    expect(callArgs.subject).toContain("[已取消]");
    expect(callArgs.text).toContain("管理員");
  });

  it("本人取消應回傳 recipientEmails", async () => {
    const result = await sendMeetingCancelMail({
      ...baseBookingInput,
      cancelledBy: { name: "佑霖", email: "booker@example.com" },
      cancelledByAdmin: false,
    });

    expect(result?.recipientEmails).toBeDefined();
    expect(mockSendViaGmail).toHaveBeenCalledOnce();
  });
});

// ─── notifyApproverOnSubmit ───────────────────────────────────

describe("notifyApproverOnSubmit", () => {
  it("找不到 action 應直接返回（不寄信）", async () => {
    mockPrisma.approvalAction.findFirst.mockResolvedValue(null);

    await notifyApproverOnSubmit("sub-1");

    expect(mockSendViaGmail).not.toHaveBeenCalled();
  });

  it("approver 無 email 應直接返回", async () => {
    mockPrisma.approvalAction.findFirst.mockResolvedValue({
      approver: { email: null },
      submission: { formType: "LEAVE", applicant: { name: "佑霖", email: "u@e.com" }, leaveRequest: { formNumber: "20260425-0001" }, expenseReport: null, overtimeRequest: null, otherExpenseRequest: null },
    });

    await notifyApproverOnSubmit("sub-1");

    expect(mockSendViaGmail).not.toHaveBeenCalled();
  });

  it("有效 action 應寄簽核通知給 approver", async () => {
    mockPrisma.approvalAction.findFirst.mockResolvedValue({
      approver: { email: "approver@example.com" },
      submission: {
        formType: "LEAVE",
        applicant: { name: "佑霖", email: "user@example.com" },
        leaveRequest: { formNumber: "20260425-0001" },
        expenseReport: null,
        overtimeRequest: null,
        otherExpenseRequest: null,
      },
    });

    await notifyApproverOnSubmit("sub-1");

    expect(mockSendViaGmail).toHaveBeenCalledOnce();
    const args = mockSendViaGmail.mock.calls[0][0];
    expect(args.to).toContain("approver@example.com");
    expect(args.subject).toContain("[待簽核]");
    expect(args.subject).toContain("請假單");
  });

  it("EXPENSE 表單應顯示正確表單名稱", async () => {
    mockPrisma.approvalAction.findFirst.mockResolvedValue({
      approver: { email: "approver@example.com" },
      submission: {
        formType: "EXPENSE",
        applicant: { name: "佑霖", email: "user@example.com" },
        leaveRequest: null,
        expenseReport: { formNumber: "EX-20260425-0001" },
        overtimeRequest: null,
        otherExpenseRequest: null,
      },
    });

    await notifyApproverOnSubmit("sub-1");

    const args = mockSendViaGmail.mock.calls[0][0];
    expect(args.subject).toContain("出差旅費報告單");
  });
});

// ─── notifyApplicantApproved ──────────────────────────────────

describe("notifyApplicantApproved", () => {
  it("申請人無 email 應直接返回", async () => {
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      formType: "LEAVE",
      applicant: { name: "佑霖", email: null },
      leaveRequest: { formNumber: "20260425-0001" },
      expenseReport: null, overtimeRequest: null, otherExpenseRequest: null,
    });

    await notifyApplicantApproved("sub-1");

    expect(mockSendViaGmail).not.toHaveBeenCalled();
  });

  it("有效資料應寄核准通知給申請人", async () => {
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      formType: "OVERTIME",
      applicant: { name: "佑霖", email: "user@example.com" },
      leaveRequest: null,
      expenseReport: null,
      overtimeRequest: { formNumber: "OT-20260425-0001" },
      otherExpenseRequest: null,
    });

    await notifyApplicantApproved("sub-1");

    expect(mockSendViaGmail).toHaveBeenCalledOnce();
    const args = mockSendViaGmail.mock.calls[0][0];
    expect(args.to).toContain("user@example.com");
    expect(args.subject).toContain("[已核准]");
    expect(args.subject).toContain("加班單");
  });
});

// ─── notifyApplicantRejected ──────────────────────────────────

describe("notifyApplicantRejected", () => {
  it("申請人無 email 應直接返回", async () => {
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      formType: "LEAVE",
      applicant: { name: "佑霖", email: null },
      leaveRequest: { formNumber: "20260425-0001" },
      expenseReport: null, overtimeRequest: null, otherExpenseRequest: null,
    });

    await notifyApplicantRejected("sub-1");

    expect(mockSendViaGmail).not.toHaveBeenCalled();
  });

  it("有退件意見應包含在通知中", async () => {
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      formType: "OTHER_EXPENSE",
      applicant: { name: "佑霖", email: "user@example.com" },
      leaveRequest: null,
      expenseReport: null,
      overtimeRequest: null,
      otherExpenseRequest: { formNumber: "OE-20260425-0001" },
    });

    await notifyApplicantRejected("sub-1", "金額有誤");

    const args = mockSendViaGmail.mock.calls[0][0];
    expect(args.subject).toContain("[已退簽]");
    expect(args.text).toContain("金額有誤");
    expect(args.subject).toContain("其他費用申請單");
  });

  it("無退件意見應正常寄送", async () => {
    mockPrisma.formSubmission.findUniqueOrThrow.mockResolvedValue({
      formType: "LEAVE",
      applicant: { name: "佑霖", email: "user@example.com" },
      leaveRequest: { formNumber: "20260425-0001" },
      expenseReport: null, overtimeRequest: null, otherExpenseRequest: null,
    });

    await notifyApplicantRejected("sub-1");

    expect(mockSendViaGmail).toHaveBeenCalledOnce();
  });
});
