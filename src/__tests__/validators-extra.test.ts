import { describe, it, expect } from "vitest";
import { createLeaveRequestSchema } from "@/lib/validators/leave";
import { bookMeetingSchema } from "@/lib/validators/meeting";
import {
  CalendarEventSchema,
  ClientCalendarEventSchema,
  ImportCalendarSchema,
} from "@/lib/validators/calendar";
import {
  updateSystemSettingSchema,
  smtpConfigSchema,
  workflowConfigSchema,
} from "@/lib/validators/settings";
import { createUserSchema, updateUserSchema } from "@/lib/validators/user";

// ─── 請假 ─────────────────────────────────────────────────────

describe("createLeaveRequestSchema", () => {
  const valid = {
    leaveTypeId: "lt-1",
    startDate: "2026-04-25",
    startTime: "09:00",
    endDate: "2026-04-25",
    endTime: "17:30",
    reason: "身體不適",
  };

  it("合法資料應通過", () => {
    expect(createLeaveRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("假別未選應失敗", () => {
    expect(createLeaveRequestSchema.safeParse({ ...valid, leaveTypeId: "" }).success).toBe(false);
  });

  it("時間格式錯誤應失敗（非 HH:00 或 HH:30）", () => {
    expect(createLeaveRequestSchema.safeParse({ ...valid, startTime: "09:15" }).success).toBe(false);
  });

  it("事由為空應失敗", () => {
    expect(createLeaveRequestSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
  });
});

// ─── 會議室預約 ───────────────────────────────────────────────

describe("bookMeetingSchema", () => {
  const valid = {
    roomId: "room-1",
    date: new Date("2026-04-25"),
    startTime: "09:00",
    endTime: "10:00",
    subject: "週會",
  };

  it("合法資料應通過", () => {
    expect(bookMeetingSchema.safeParse(valid).success).toBe(true);
  });

  it("roomId 為空應失敗", () => {
    expect(bookMeetingSchema.safeParse({ ...valid, roomId: "" }).success).toBe(false);
  });

  it("主題為空應失敗", () => {
    expect(bookMeetingSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
  });

  it("attendeeEmails 有非法 email 應失敗", () => {
    expect(bookMeetingSchema.safeParse({ ...valid, attendeeEmails: ["not-an-email"] }).success).toBe(false);
  });

  it("attendeeEmails 為合法 email 陣列應通過", () => {
    expect(bookMeetingSchema.safeParse({ ...valid, attendeeEmails: ["a@b.com"] }).success).toBe(true);
  });
});

// ─── 行事曆 ───────────────────────────────────────────────────

describe("CalendarEventSchema", () => {
  const valid = {
    date: "2026-04-25",
    personName: "佑霖",
    status: "CONFIRMED" as const,
  };

  it("合法資料應通過", () => {
    expect(CalendarEventSchema.safeParse(valid).success).toBe(true);
  });

  it("日期格式錯誤應失敗", () => {
    expect(CalendarEventSchema.safeParse({ ...valid, date: "25-04-2026" }).success).toBe(false);
  });

  it("personName 為空應失敗", () => {
    expect(CalendarEventSchema.safeParse({ ...valid, personName: "" }).success).toBe(false);
  });

  it("非法 status 應失敗", () => {
    expect(CalendarEventSchema.safeParse({ ...valid, status: "UNKNOWN" }).success).toBe(false);
  });
});

describe("ClientCalendarEventSchema", () => {
  it("合法資料應通過", () => {
    expect(ClientCalendarEventSchema.safeParse({ date: "2026-04-25", event: "外稽" }).success).toBe(true);
  });

  it("event 為空應失敗", () => {
    expect(ClientCalendarEventSchema.safeParse({ date: "2026-04-25", event: "" }).success).toBe(false);
  });
});

describe("ImportCalendarSchema", () => {
  it("空陣列應通過", () => {
    expect(ImportCalendarSchema.safeParse({ events: [], clientEvents: [] }).success).toBe(true);
  });
});

// ─── 系統設定 ─────────────────────────────────────────────────

describe("updateSystemSettingSchema", () => {
  it("合法資料應通過", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "smtp_host", value: "smtp.gmail.com" }).success).toBe(true);
  });

  it("value 為空應失敗", () => {
    expect(updateSystemSettingSchema.safeParse({ key: "k", value: "" }).success).toBe(false);
  });
});

describe("smtpConfigSchema", () => {
  it("合法資料應通過", () => {
    expect(smtpConfigSchema.safeParse({ senderName: "EIP", senderEmail: "eip@example.com" }).success).toBe(true);
  });

  it("非法 email 應失敗", () => {
    expect(smtpConfigSchema.safeParse({ senderName: "EIP", senderEmail: "not-email" }).success).toBe(false);
  });
});

describe("workflowConfigSchema", () => {
  const valid = {
    formType: "LEAVE" as const,
    steps: [{ stepOrder: 1, approverRole: "DIRECT_MANAGER" }],
  };

  it("合法資料應通過", () => {
    expect(workflowConfigSchema.safeParse(valid).success).toBe(true);
  });

  it("steps 為空應失敗", () => {
    expect(workflowConfigSchema.safeParse({ ...valid, steps: [] }).success).toBe(false);
  });

  it("非法 formType 應失敗", () => {
    expect(workflowConfigSchema.safeParse({ ...valid, formType: "UNKNOWN" }).success).toBe(false);
  });
});

// ─── 使用者 ───────────────────────────────────────────────────

describe("createUserSchema", () => {
  const valid = { email: "user@example.com", name: "佑霖", role: "USER" as const };

  it("合法資料應通過", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it("非法 email 應失敗", () => {
    expect(createUserSchema.safeParse({ ...valid, email: "bad" }).success).toBe(false);
  });

  it("name 為空應失敗", () => {
    expect(createUserSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("非法 role 應失敗", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "SUPERADMIN" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  const valid = { id: "u1", email: "user@example.com", name: "佑霖", role: "USER" as const, isActive: true };

  it("合法資料應通過", () => {
    expect(updateUserSchema.safeParse(valid).success).toBe(true);
  });

  it("缺少 id 應失敗", () => {
    const { id: _, ...rest } = valid;
    expect(updateUserSchema.safeParse(rest).success).toBe(false);
  });
});
