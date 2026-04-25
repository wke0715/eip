import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockParseCalendarExcel = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  calendarEvent: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  clientCalendarEvent: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/excel-parser", () => ({ parseCalendarExcel: mockParseCalendarExcel }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  importCalendarFromExcel,
  getCalendarEvents,
  getCalendarPersonNames,
  upsertCalendarEvent,
  deleteCalendarEvent,
} from "@/actions/calendar";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.calendarEvent.upsert.mockResolvedValue({});
  mockPrisma.calendarEvent.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.clientCalendarEvent.deleteMany.mockResolvedValue({});
  mockPrisma.clientCalendarEvent.createMany.mockResolvedValue({});
});

// ─── importCalendarFromExcel ──────────────────────────────────

describe("importCalendarFromExcel", () => {
  it("未選擇檔案應回傳 success: false", async () => {
    const fd = new FormData();
    const result = await importCalendarFromExcel(fd);
    expect(result.success).toBe(false);
    expect(result.message).toContain("請選擇");
  });

  it("Excel 解析錯誤應回傳 success: false", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([""], { type: "application/vnd.ms-excel" }));
    mockParseCalendarExcel.mockReturnValue({ events: [], clientEvents: [], errors: ["格式錯誤"] });

    const result = await importCalendarFromExcel(fd);
    expect(result.success).toBe(false);
    expect(result.message).toBe("格式錯誤");
  });

  it("合法資料應 upsert 並回傳 success: true", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([""], { type: "application/vnd.ms-excel" }));
    mockParseCalendarExcel.mockReturnValue({
      events: [{
        date: "2026-04-25",
        personName: "佑霖",
        amTask: "開會",
        pmTask: null,
        fullDayTask: null,
        status: "CONFIRMED",
        isHoliday: false,
        weekNumber: 17,
      }],
      clientEvents: [],
      errors: [],
    });

    const result = await importCalendarFromExcel(fd);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("有 clientEvents 應先刪後插", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([""], { type: "application/vnd.ms-excel" }));
    mockParseCalendarExcel.mockReturnValue({
      events: [],
      clientEvents: [
        { date: "2026-04-25", event: "客戶拜訪" },
        { date: "2026-04-25", event: "展覽" },
      ],
      errors: [],
    });

    await importCalendarFromExcel(fd);

    expect(mockPrisma.clientCalendarEvent.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.clientCalendarEvent.createMany).toHaveBeenCalled();
  });
});

// ─── getCalendarEvents ────────────────────────────────────────

describe("getCalendarEvents", () => {
  it("指定年月應回傳 events 和 clientEvents", async () => {
    const events = [{ id: "e1", personName: "佑霖" }];
    const clientEvents = [{ id: "ce1", event: "客戶拜訪" }];
    mockPrisma.calendarEvent.findMany.mockResolvedValue(events);
    mockPrisma.clientCalendarEvent.findMany.mockResolvedValue(clientEvents);

    const result = await getCalendarEvents({ year: 2026, month: 4 });

    expect(result.events).toEqual(events);
    expect(result.clientEvents).toEqual(clientEvents);
  });

  it("指定全年（不傳 month）應查整年", async () => {
    mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
    mockPrisma.clientCalendarEvent.findMany.mockResolvedValue([]);

    await getCalendarEvents({ year: 2026 });

    expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalled();
  });

  it("指定 personName 應過濾特定人員", async () => {
    mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
    mockPrisma.clientCalendarEvent.findMany.mockResolvedValue([]);

    await getCalendarEvents({ year: 2026, month: 4, personName: "佑霖" });

    expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ personName: "佑霖" }),
      })
    );
  });
});

// ─── getCalendarPersonNames ───────────────────────────────────

describe("getCalendarPersonNames", () => {
  it("應回傳人員名單陣列", async () => {
    mockPrisma.calendarEvent.findMany.mockResolvedValue([
      { personName: "佑霖" },
      { personName: "志遠" },
    ]);

    const result = await getCalendarPersonNames();
    expect(result).toEqual(["佑霖", "志遠"]);
  });
});

// ─── upsertCalendarEvent ──────────────────────────────────────

describe("upsertCalendarEvent", () => {
  it("資料驗證失敗應回傳 success: false", async () => {
    const result = await upsertCalendarEvent({
      date: "invalid-date",
      personName: "",
    });
    expect(result.success).toBe(false);
  });

  it("合法資料應 upsert 並回傳 success: true", async () => {
    const result = await upsertCalendarEvent({
      date: "2026-04-25",
      personName: "佑霖",
      status: "CONFIRMED",
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.calendarEvent.upsert).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/calendar");
  });
});

// ─── deleteCalendarEvent ──────────────────────────────────────

describe("deleteCalendarEvent", () => {
  it("找到資料應刪除並回傳 success: true", async () => {
    mockPrisma.calendarEvent.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteCalendarEvent("2026-04-25", "佑霖");

    expect(result.success).toBe(true);
    expect(result.message).toBe("已刪除");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("找不到資料應回傳 success: false", async () => {
    mockPrisma.calendarEvent.deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteCalendarEvent("2026-04-25", "不存在");

    expect(result.success).toBe(false);
    expect(result.message).toContain("找不到");
  });
});
