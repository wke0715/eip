export interface CalendarEventInput {
  uid: string;
  date: Date;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  subject: string;
  description?: string;
  location?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendees?: Array<{ name?: string | null; email: string }>;
  method?: "REQUEST" | "CANCEL";
  sequence?: number;
}

// 把「台北時區的日期 + HH:mm」轉成 UTC 的 ICS datetime 字串（20260413T060000Z）
function toUtcIcsDateTime(date: Date, time: string): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const [hh, mm] = time.split(":").map(Number);
  const utc = new Date(Date.UTC(year, month, day, hh - 8, mm, 0));
  return formatIcsUtc(utc);
}

function formatIcsUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// ICS 規定特殊字元需要 escape
function escapeIcsText(s: string): string {
  return s
    .replaceAll("\\", String.raw`\\`)
    .replaceAll(";", String.raw`\;`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll(/\r?\n/g, String.raw`\n`);
}

export function generateIcsContent(event: CalendarEventInput): string {
  const dtStart = toUtcIcsDateTime(event.date, event.startTime);
  const dtEnd = toUtcIcsDateTime(event.date, event.endTime);
  const dtStamp = formatIcsUtc(new Date());
  const method = event.method ?? "REQUEST";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EIP//Meeting//ZH-TW",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.subject)}`,
    `SEQUENCE:${event.sequence ?? (method === "CANCEL" ? 1 : 0)}`,
  ];

  if (method === "CANCEL") {
    lines.push("STATUS:CANCELLED");
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.organizerEmail) {
    const cn = event.organizerName
      ? `;CN=${escapeIcsText(event.organizerName)}`
      : "";
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail}`);
  }
  for (const a of event.attendees ?? []) {
    const cn = a.name ? `;CN=${escapeIcsText(a.name)}` : "";
    lines.push(`ATTENDEE${cn};RSVP=TRUE:mailto:${a.email}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

// 產生 Google Calendar 一鍵加入連結
export function buildGoogleCalendarUrl(event: CalendarEventInput): string {
  const dtStart = toUtcIcsDateTime(event.date, event.startTime);
  const dtEnd = toUtcIcsDateTime(event.date, event.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.subject,
    dates: `${dtStart}/${dtEnd}`,
    details: event.description ?? "",
    location: event.location ?? "",
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}
