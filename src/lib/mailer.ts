import { prisma } from "./prisma";
import {
  generateIcsContent,
  buildGoogleCalendarUrl,
  type CalendarEventInput,
} from "./ics";

async function getSenderConfig() {
  const config = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });
  if (!config) throw new Error("尚未設定寄件人資訊");
  return { from: `${config.senderName} <${config.senderEmail}>` };
}

async function sendEmail(params: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  icsContent?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("未設定 RESEND_API_KEY 環境變數");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const attachments = params.icsContent
    ? [{ filename: "meeting.ics", content: Buffer.from(params.icsContent) }]
    : [];

  const result = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments,
  });

  if (result.error) throw new Error(result.error.message);
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

  await sendEmail({
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

  await sendEmail({
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
