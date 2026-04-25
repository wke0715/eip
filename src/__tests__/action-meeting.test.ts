import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockSendMeetingBookingMail = vi.hoisted(() => vi.fn());
const mockSendMeetingCancelMail = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  meetingBooking: {
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  meetingRoom: { findMany: vi.fn() },
  user: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  systemLog: { create: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/mailer", () => ({
  sendMeetingBookingMail: mockSendMeetingBookingMail,
  sendMeetingCancelMail: mockSendMeetingCancelMail,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  bookMeetingRoom,
  cancelMeetingBooking,
  getMeetingRooms,
  getMeetingBookingsForMonth,
  updateMeetingBooking,
} from "@/actions/meeting";

const authedSession = { user: { id: "user-1", email: "user@example.com", name: "佑霖", role: "USER" } };

function makeBookingFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("roomId", overrides.roomId ?? "room-1");
  fd.append("date", overrides.date ?? "2026-04-27");
  fd.append("startTime", overrides.startTime ?? "09:00");
  fd.append("endTime", overrides.endTime ?? "10:00");
  fd.append("subject", overrides.subject ?? "週會");
  return fd;
}

const fakeBooking = {
  id: "booking-1",
  roomId: "room-1",
  bookerId: "user-1",
  date: new Date("2026-04-27T00:00:00Z"),
  startTime: "09:00",
  endTime: "10:00",
  subject: "週會",
  isCancelled: false,
  createdAt: new Date("2026-04-27T00:00:00Z"),
  room: { id: "room-1", name: "大會議室", location: "3F" },
  booker: { id: "user-1", name: "佑霖", email: "user@example.com" },
  attendees: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.systemLog.create.mockResolvedValue({});
  mockSendMeetingBookingMail.mockResolvedValue({ recipientEmails: ["user@example.com"] });
  mockSendMeetingCancelMail.mockResolvedValue({ recipientEmails: ["user@example.com"] });
});

// ─── bookMeetingRoom ──────────────────────────────────────────

describe("bookMeetingRoom", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(bookMeetingRoom(makeBookingFormData())).rejects.toThrow("未登入");
  });

  it("結束時間早於開始時間應回傳 error", async () => {
    mockAuth.mockResolvedValue(authedSession);
    const fd = makeBookingFormData({ startTime: "10:00", endTime: "09:00" });
    const result = await bookMeetingRoom(fd);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("結束時間");
  });

  it("時段衝突應回傳 error", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findMany.mockResolvedValue([
      { startTime: "09:00", endTime: "11:00" },
    ]);
    const result = await bookMeetingRoom(makeBookingFormData());
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("已被預約");
  });

  it("無衝突應建立預約並回傳 id", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.meetingBooking.create.mockResolvedValue(fakeBooking);

    const result = await bookMeetingRoom(makeBookingFormData());

    expect(result).toEqual({ id: "booking-1" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/meeting");
  });

  it("有 booker email 應寄送通知信", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.meetingBooking.create.mockResolvedValue(fakeBooking);

    await bookMeetingRoom(makeBookingFormData());

    expect(mockSendMeetingBookingMail).toHaveBeenCalled();
  });
});

// ─── cancelMeetingBooking ─────────────────────────────────────

describe("cancelMeetingBooking", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(cancelMeetingBooking("booking-1")).rejects.toThrow("未登入");
  });

  it("不是自己的預約且非管理員應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue({
      ...fakeBooking,
      bookerId: "other-user",
    });
    await expect(cancelMeetingBooking("booking-1")).rejects.toThrow("只能取消自己的預約");
  });

  it("已取消的預約應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue({
      ...fakeBooking,
      isCancelled: true,
    });
    await expect(cancelMeetingBooking("booking-1")).rejects.toThrow("此預約已取消");
  });

  it("本人取消應更新 isCancelled 並寄通知", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue(fakeBooking);
    mockPrisma.meetingBooking.update.mockResolvedValue({});
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ name: "佑霖", email: "user@example.com" });

    await cancelMeetingBooking("booking-1");

    expect(mockPrisma.meetingBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "booking-1" }, data: { isCancelled: true } })
    );
    expect(mockSendMeetingCancelMail).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/meeting");
  });

  it("管理員可以取消別人的預約", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" } });
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue({
      ...fakeBooking,
      bookerId: "other-user",
    });
    mockPrisma.meetingBooking.update.mockResolvedValue({});
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ name: "Admin", email: "admin@example.com" });

    await cancelMeetingBooking("booking-1");

    expect(mockPrisma.meetingBooking.update).toHaveBeenCalled();
  });
});

// ─── getMeetingRooms ──────────────────────────────────────────

describe("getMeetingRooms", () => {
  it("應回傳啟用的會議室列表", async () => {
    const rooms = [{ id: "room-1", name: "大會議室", isActive: true }];
    mockPrisma.meetingRoom.findMany.mockResolvedValue(rooms);
    const result = await getMeetingRooms();
    expect(result).toEqual(rooms);
  });
});

// ─── getMeetingBookingsForMonth ───────────────────────────────

describe("getMeetingBookingsForMonth", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getMeetingBookingsForMonth(2026, 4)).rejects.toThrow("未登入");
  });

  it("已登入應回傳當月預約（date 序列化為 string）", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findMany.mockResolvedValue([fakeBooking]);

    const result = await getMeetingBookingsForMonth(2026, 4);

    expect(result[0].date).toBe(fakeBooking.date.toISOString());
    expect(result[0].createdAt).toBe(fakeBooking.createdAt.toISOString());
  });
});

// ─── updateMeetingBooking ─────────────────────────────────────

describe("updateMeetingBooking", () => {
  it("未登入應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(updateMeetingBooking("booking-1", makeBookingFormData())).rejects.toThrow("未登入");
  });

  it("不是自己的預約且非管理員應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue({
      ...fakeBooking,
      bookerId: "other",
      isCancelled: false,
    });
    await expect(updateMeetingBooking("booking-1", makeBookingFormData())).rejects.toThrow("只能編輯自己的預約");
  });

  it("已取消的預約應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue({
      ...fakeBooking,
      isCancelled: true,
    });
    await expect(updateMeetingBooking("booking-1", makeBookingFormData())).rejects.toThrow("此預約已取消");
  });

  it("時段衝突應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue(fakeBooking);
    mockPrisma.meetingBooking.findMany.mockResolvedValue([
      { startTime: "09:30", endTime: "11:00" },
    ]);
    await expect(updateMeetingBooking("booking-1", makeBookingFormData())).rejects.toThrow("該時段已被預約");
  });

  it("合法更新應儲存並 revalidate", async () => {
    mockAuth.mockResolvedValue(authedSession);
    mockPrisma.meetingBooking.findUniqueOrThrow.mockResolvedValue(fakeBooking);
    mockPrisma.meetingBooking.findMany.mockResolvedValue([]);
    mockPrisma.meetingBooking.update.mockResolvedValue({});

    await updateMeetingBooking("booking-1", makeBookingFormData());

    expect(mockPrisma.meetingBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "booking-1" } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/meeting");
  });
});
