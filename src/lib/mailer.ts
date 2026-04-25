import { prisma } from "./prisma";
import { sendViaGmail } from "./gmail";
import {
  generateIcsContent,
  buildGoogleCalendarUrl,
  type CalendarEventInput,
} from "./ics";

async function getSenderConfig() {
  const config = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });
  const gmailUser = process.env.GMAIL_USER;
  if (!gmailUser) throw new Error("未設定 GMAIL_USER 環境變數");
  const senderName = config?.senderName ?? "企盉 EIP";
  return { from: `${senderName} <${gmailUser}>` };
}

export interface BookingMailInput {
  bookingId: string;
  subject: string;
  date: Date;
  startTime: string;
  endTime: string;
  roomName: string;
  roomLocation?: string | null;
  booker: { name: string | null; email: string };
  attendees: Array<{ name: string | null; email: string }>;
}

function formatTaipeiDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function buildRecipients(input: BookingMailInput) {
  const allEmails = new Set<string>();
  const recipients: Array<{ name: string | null; email: string }> = [];
  for (const person of [input.booker, ...input.attendees]) {
    if (person.email && !allEmails.has(person.email)) {
      allEmails.add(person.email);
      recipients.push(person);
    }
  }
  return recipients;
}

function buildMailContext(input: BookingMailInput) {
  const locationLabel = input.roomLocation
    ? `${input.roomName}（${input.roomLocation}）`
    : input.roomName;
  const dateStr = formatTaipeiDate(input.date);
  const timeRange = `${input.startTime} – ${input.endTime}`;
  const attendeesText = input.attendees
    .map((a) => a.name ?? a.email)
    .join("、");
  return { locationLabel, dateStr, timeRange, attendeesText };
}

export async function sendMeetingBookingMail(input: BookingMailInput) {
  const recipients = buildRecipients(input);
  if (recipients.length === 0) return;

  const { from } = await getSenderConfig();
  const { locationLabel, dateStr, timeRange, attendeesText } =
    buildMailContext(input);

  const calendarEvent: CalendarEventInput = {
    uid: `${input.bookingId}@eip`,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    subject: input.subject,
    description: `會議室：${locationLabel}\n發起人：${
      input.booker.name ?? input.booker.email
    }\n與會人：${attendeesText}`,
    location: locationLabel,
    organizerName: input.booker.name ?? undefined,
    organizerEmail: input.booker.email,
    attendees: input.attendees,
  };

  const icsContent = generateIcsContent(calendarEvent);
  const googleUrl = buildGoogleCalendarUrl(calendarEvent);

  const text = [
    `您有一個新的會議邀請：`,
    ``,
    `主題：${input.subject}`,
    `日期：${dateStr}`,
    `時間：${timeRange}（台北時間）`,
    `會議室：${locationLabel}`,
    `發起人：${input.booker.name ?? input.booker.email}`,
    `與會人：${attendeesText}`,
    ``,
    `加入 Google 行事曆：${googleUrl}`,
    `（或直接開啟附件的 .ics 檔案加入 Outlook / Apple 行事曆）`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 16px;">您有一個新的會議邀請</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 6px 0; color: #666; width: 80px;">主題</td><td style="padding: 6px 0;"><strong>${escapeHtml(input.subject)}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">日期</td><td style="padding: 6px 0;">${dateStr}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">時間</td><td style="padding: 6px 0;">${timeRange}（台北時間）</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">會議室</td><td style="padding: 6px 0;">${escapeHtml(locationLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">發起人</td><td style="padding: 6px 0;">${escapeHtml(input.booker.name ?? input.booker.email)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">與會人</td><td style="padding: 6px 0;">${escapeHtml(attendeesText)}</td></tr>
      </table>
      <div style="margin-top: 24px;">
        <a href="${googleUrl}" style="display: inline-block; padding: 10px 18px; background: #1a73e8; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px;">加入 Google 行事曆</a>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #888;">
        使用 Outlook / Apple 行事曆的用戶，請開啟附件中的 <code>meeting.ics</code> 檔案。
      </p>
    </div>
  `;

  await sendViaGmail({
    from,
    to: recipients.map((a) => a.email),
    subject: `[會議邀請] ${input.subject}（${dateStr} ${timeRange}）`,
    text,
    html,
    icsContent,
  });

  return { recipientEmails: recipients.map((a) => a.email) };
}

export interface CancelMailInput extends BookingMailInput {
  cancelledBy: { name: string | null; email: string };
  cancelledByAdmin: boolean;
}

export async function sendMeetingCancelMail(input: CancelMailInput) {
  const recipients = buildRecipients(input);
  if (recipients.length === 0) return;

  const { from } = await getSenderConfig();
  const { locationLabel, dateStr, timeRange, attendeesText } =
    buildMailContext(input);

  const cancelledByLabel = input.cancelledByAdmin
    ? `${input.cancelledBy.name ?? input.cancelledBy.email}（管理員）`
    : (input.cancelledBy.name ?? input.cancelledBy.email);

  const calendarEvent: CalendarEventInput = {
    uid: `${input.bookingId}@eip`,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    subject: input.subject,
    description: `此會議已被取消。\n取消者：${cancelledByLabel}\n會議室：${locationLabel}`,
    location: locationLabel,
    organizerName: input.booker.name ?? undefined,
    organizerEmail: input.booker.email,
    attendees: input.attendees,
    method: "CANCEL",
    sequence: 1,
  };

  const icsContent = generateIcsContent(calendarEvent);

  const text = [
    `以下會議已被取消：`,
    ``,
    `主題：${input.subject}`,
    `日期：${dateStr}`,
    `時間：${timeRange}（台北時間）`,
    `會議室：${locationLabel}`,
    `發起人：${input.booker.name ?? input.booker.email}`,
    `與會人：${attendeesText}`,
    `取消者：${cancelledByLabel}`,
    ``,
    `您行事曆中的此事件將會自動移除（或開啟附件 meeting.ics 以同步取消）。`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 16px; color: #c00;">會議已取消</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 6px 0; color: #666; width: 80px;">主題</td><td style="padding: 6px 0;"><strong style="text-decoration: line-through;">${escapeHtml(input.subject)}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">日期</td><td style="padding: 6px 0;">${dateStr}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">時間</td><td style="padding: 6px 0;">${timeRange}（台北時間）</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">會議室</td><td style="padding: 6px 0;">${escapeHtml(locationLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">發起人</td><td style="padding: 6px 0;">${escapeHtml(input.booker.name ?? input.booker.email)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">與會人</td><td style="padding: 6px 0;">${escapeHtml(attendeesText)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">取消者</td><td style="padding: 6px 0; color: #c00;">${escapeHtml(cancelledByLabel)}</td></tr>
      </table>
      <p style="margin-top: 16px; font-size: 12px; color: #888;">
        您行事曆中的此事件將自動移除。若未移除，請開啟附件中的 <code>meeting.ics</code> 檔案。
      </p>
    </div>
  `;

  await sendViaGmail({
    from,
    to: recipients.map((a) => a.email),
    subject: `[已取消] ${input.subject}（${dateStr} ${timeRange}）`,
    text,
    html,
    icsContent,
  });

  return { recipientEmails: recipients.map((a) => a.email) };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── 表單簽核 email 通知 ───

const FORM_TYPE_NAMES: Record<string, string> = {
  LEAVE: "請假單",
  EXPENSE: "出差旅費報告單",
  OVERTIME: "加班單",
  OTHER_EXPENSE: "其他費用申請單",
};

function pickFormNumber(sub: {
  leaveRequest?: { formNumber: string } | null;
  expenseReport?: { formNumber: string } | null;
  overtimeRequest?: { formNumber: string } | null;
  otherExpenseRequest?: { formNumber: string } | null;
}): string {
  return (
    sub.leaveRequest?.formNumber ??
    sub.expenseReport?.formNumber ??
    sub.overtimeRequest?.formNumber ??
    sub.otherExpenseRequest?.formNumber ??
    ""
  );
}

function buildApprovalMailHtml(
  title: string,
  rows: [string, string][],
  footer?: string,
): string {
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;">${label}</td>` +
        `<td style="padding:6px 0;"><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join("");
  return (
    `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;">` +
    `<h2 style="margin:0 0 16px;">${escapeHtml(title)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;">${rowsHtml}</table>` +
    (footer ? `<p style="margin-top:16px;font-size:14px;">${footer}</p>` : "") +
    `</div>`
  );
}

const formDetailInclude = {
  applicant: { select: { name: true, email: true } },
  leaveRequest: { select: { formNumber: true } },
  expenseReport: { select: { formNumber: true } },
  overtimeRequest: { select: { formNumber: true } },
  otherExpenseRequest: { select: { formNumber: true } },
} as const;

/** 通知簽核者有新表單待簽（初次送出用 stepOrder=1，進入下一關傳對應的 stepOrder）*/
export async function notifyApproverOnSubmit(
  submissionId: string,
  stepOrder = 1,
): Promise<void> {
  console.log(`[EIP email] notifyApproverOnSubmit submissionId=${submissionId} stepOrder=${stepOrder}`);
  const action = await prisma.approvalAction.findFirst({
    where: { submissionId, stepOrder },
    include: {
      approver: { select: { email: true } },
      submission: { include: formDetailInclude },
    },
    orderBy: { round: "desc" },
  });
  if (!action?.approver.email) {
    console.log(`[EIP email] notifyApproverOnSubmit: no action found or email missing, skipping`);
    return;
  }

  const sub = action.submission;
  const formTypeName = FORM_TYPE_NAMES[sub.formType] ?? sub.formType;
  const formNumber = pickFormNumber(sub);
  const applicantName = sub.applicant.name ?? sub.applicant.email ?? "";
  const { from } = await getSenderConfig();
  const siteUrl = process.env.NEXTAUTH_URL ?? "";
  const inboxUrl = siteUrl ? `${siteUrl}/inbox` : "";

  await sendViaGmail({
    from,
    to: [action.approver.email],
    subject: `[待簽核] ${formTypeName}｜${applicantName}`,
    text: [
      `${applicantName} 提交了一張${formTypeName}（${formNumber}），需要您的簽核。`,
      "",
      inboxUrl ? `前往收件匣：${inboxUrl}` : "請登入 EIP 系統前往收件匣簽核。",
    ].join("\n"),
    html: buildApprovalMailHtml(
      `新的待簽核${formTypeName}`,
      [["表單編號", formNumber], ["申請人", applicantName]],
      inboxUrl
        ? `請前往 <a href="${inboxUrl}">收件匣</a> 簽核。`
        : "請登入 EIP 系統前往收件匣簽核。",
    ),
  });
}

/** 通知申請人表單已全部核准 */
export async function notifyApplicantApproved(submissionId: string): Promise<void> {
  console.log(`[EIP email] notifyApplicantApproved submissionId=${submissionId}`);
  const sub = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: formDetailInclude,
  });
  if (!sub.applicant.email) {
    console.log(`[EIP email] notifyApplicantApproved: applicant email missing, skipping`);
    return;
  }

  const formTypeName = FORM_TYPE_NAMES[sub.formType] ?? sub.formType;
  const formNumber = pickFormNumber(sub);
  const { from } = await getSenderConfig();
  const siteUrl = process.env.NEXTAUTH_URL ?? "";
  const outboxUrl = siteUrl ? `${siteUrl}/outbox` : "";

  await sendViaGmail({
    from,
    to: [sub.applicant.email],
    subject: `[已核准] ${formTypeName}｜${formNumber}`,
    text: [
      `您的${formTypeName}（${formNumber}）已通過所有關卡核准。`,
      "",
      outboxUrl ? `前往寄件匣：${outboxUrl}` : "請登入 EIP 系統查看。",
    ].join("\n"),
    html: buildApprovalMailHtml(
      "申請已核准",
      [["表單編號", formNumber], ["表單類型", formTypeName], ["結果", "已核准"]],
      outboxUrl ? `請前往 <a href="${outboxUrl}">寄件匣</a> 查看。` : "",
    ),
  });
}

/** 通知申請人表單已退簽 */
export async function notifyApplicantRejected(
  submissionId: string,
  comment?: string | null,
): Promise<void> {
  console.log(`[EIP email] notifyApplicantRejected submissionId=${submissionId}`);
  const sub = await prisma.formSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: formDetailInclude,
  });
  if (!sub.applicant.email) {
    console.log(`[EIP email] notifyApplicantRejected: applicant email missing, skipping`);
    return;
  }

  const formTypeName = FORM_TYPE_NAMES[sub.formType] ?? sub.formType;
  const formNumber = pickFormNumber(sub);
  const { from } = await getSenderConfig();
  const siteUrl = process.env.NEXTAUTH_URL ?? "";
  const outboxUrl = siteUrl ? `${siteUrl}/outbox` : "";

  const rows: [string, string][] = [
    ["表單編號", formNumber],
    ["表單類型", formTypeName],
    ["結果", "已退簽"],
  ];
  if (comment) rows.push(["退簽意見", comment]);

  await sendViaGmail({
    from,
    to: [sub.applicant.email],
    subject: `[已退簽] ${formTypeName}｜${formNumber}`,
    text: [
      `您的${formTypeName}（${formNumber}）已被退簽。`,
      comment ? `退簽意見：${comment}` : "",
      "",
      outboxUrl ? `前往寄件匣：${outboxUrl}` : "請登入 EIP 系統查看或重送。",
    ]
      .filter((l) => l !== "")
      .join("\n"),
    html: buildApprovalMailHtml(
      "申請已退簽",
      rows,
      outboxUrl ? `請前往 <a href="${outboxUrl}">寄件匣</a> 查看或重送。` : "",
    ),
  });
}
