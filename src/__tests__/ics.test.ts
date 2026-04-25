import { describe, it, expect } from "vitest";
import { generateIcsContent, buildGoogleCalendarUrl } from "@/lib/ics";

const baseEvent = {
  uid: "test-uid-123",
  date: new Date("2026-04-25T00:00:00Z"),
  startTime: "09:00",
  endTime: "10:00",
  subject: "測試會議",
};

describe("generateIcsContent", () => {
  it("應包含 VCALENDAR 基本結構", () => {
    const ics = generateIcsContent(baseEvent);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("應包含正確的 UID、SUMMARY 與預設 METHOD:REQUEST", () => {
    const ics = generateIcsContent(baseEvent);
    expect(ics).toContain("UID:test-uid-123");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("SUMMARY:測試會議");
  });

  it("台北時間 09:00 應轉換為 UTC 01:00", () => {
    const ics = generateIcsContent(baseEvent);
    expect(ics).toContain("DTSTART:20260425T010000Z");
    expect(ics).toContain("DTEND:20260425T020000Z");
  });

  it("CANCEL method 應加入 STATUS:CANCELLED 且 SEQUENCE 預設為 1", () => {
    const ics = generateIcsContent({ ...baseEvent, method: "CANCEL" });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:1");
  });

  it("有 description 應加入 DESCRIPTION 行", () => {
    const ics = generateIcsContent({ ...baseEvent, description: "會議說明" });
    expect(ics).toContain("DESCRIPTION:會議說明");
  });

  it("沒有 description 不應有 DESCRIPTION 行", () => {
    const ics = generateIcsContent(baseEvent);
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("有 location 應加入 LOCATION 行", () => {
    const ics = generateIcsContent({ ...baseEvent, location: "台北辦公室" });
    expect(ics).toContain("LOCATION:台北辦公室");
  });

  it("有 organizer 應加入帶 CN 的 ORGANIZER 行", () => {
    const ics = generateIcsContent({
      ...baseEvent,
      organizerName: "佑霖",
      organizerEmail: "test@example.com",
    });
    expect(ics).toContain("ORGANIZER;CN=佑霖:mailto:test@example.com");
  });

  it("只有 organizerEmail（無名稱）應產生不帶 CN 的 ORGANIZER", () => {
    const ics = generateIcsContent({
      ...baseEvent,
      organizerEmail: "anon@example.com",
    });
    expect(ics).toContain("ORGANIZER:mailto:anon@example.com");
  });

  it("有 attendees 應加入 ATTENDEE 行", () => {
    const ics = generateIcsContent({
      ...baseEvent,
      attendees: [
        { name: "Alice", email: "alice@example.com" },
        { email: "bob@example.com" },
      ],
    });
    expect(ics).toContain("ATTENDEE;CN=Alice;RSVP=TRUE:mailto:alice@example.com");
    expect(ics).toContain("ATTENDEE;RSVP=TRUE:mailto:bob@example.com");
  });

  it("逗號和分號應被 escape", () => {
    const ics = generateIcsContent({ ...baseEvent, subject: "A,B;C" });
    expect(ics).toContain("SUMMARY:A\\,B\\;C");
  });

  it("自訂 sequence 應使用指定值", () => {
    const ics = generateIcsContent({ ...baseEvent, sequence: 3 });
    expect(ics).toContain("SEQUENCE:3");
  });

  it("應使用 CRLF 分隔行", () => {
    const ics = generateIcsContent(baseEvent);
    expect(ics).toContain("\r\n");
  });
});

describe("buildGoogleCalendarUrl", () => {
  it("應以 Google Calendar 網址開頭", () => {
    const url = buildGoogleCalendarUrl(baseEvent);
    expect(url).toMatch(/^https:\/\/www\.google\.com\/calendar\/render/);
  });

  it("應包含 action=TEMPLATE", () => {
    const url = buildGoogleCalendarUrl(baseEvent);
    expect(url).toContain("action=TEMPLATE");
  });

  it("應包含 subject 作為 text 參數", () => {
    const url = buildGoogleCalendarUrl(baseEvent);
    expect(decodeURIComponent(url)).toContain("測試會議");
  });

  it("應包含 dates 參數（開始/結束時間）", () => {
    const url = buildGoogleCalendarUrl(baseEvent);
    expect(url).toContain("dates=");
    expect(url).toContain("20260425T010000Z");
  });

  it("有 description 應帶入 details 參數", () => {
    const url = buildGoogleCalendarUrl({ ...baseEvent, description: "說明文字" });
    expect(decodeURIComponent(url)).toContain("說明文字");
  });

  it("有 location 應帶入 location 參數", () => {
    const url = buildGoogleCalendarUrl({ ...baseEvent, location: "台北" });
    expect(decodeURIComponent(url)).toContain("台北");
  });
});
