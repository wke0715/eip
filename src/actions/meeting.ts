"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookMeetingSchema } from "@/lib/validators/meeting";
import { isTimeOverlap } from "@/lib/meeting-utils";
import { sendMeetingBookingMail, sendMeetingCancelMail } from "@/lib/mailer";
import { revalidatePath } from "next/cache";

export async function bookMeetingRoom(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const raw = {
    roomId: formData.get("roomId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    subject: formData.get("subject"),
    attendeeEmails: formData.getAll("attendeeEmails").filter(Boolean) as string[],
  };

  const parsed = bookMeetingSchema.parse(raw);

  // 檢查時段有效性
  if (parsed.startTime >= parsed.endTime) {
    throw new Error("結束時間須晚於起始時間");
  }

  // 檢查時段衝突
  const existingBookings = await prisma.meetingBooking.findMany({
    where: {
      roomId: parsed.roomId,
      date: parsed.date,
      isCancelled: false,
    },
  });

  const hasConflict = existingBookings.some((b) =>
    isTimeOverlap(parsed.startTime, parsed.endTime, b.startTime, b.endTime)
  );

  if (hasConflict) {
    throw new Error("該時段已被預約");
  }

  // 查詢與會者
  const attendeeUsers = parsed.attendeeEmails?.length
    ? await prisma.user.findMany({
        where: { email: { in: parsed.attendeeEmails }, isActive: true },
        select: { id: true, name: true, email: true },
      })
    : [];

  const booking = await prisma.meetingBooking.create({
    data: {
      roomId: parsed.roomId,
      bookerId: session.user.id,
      date: parsed.date,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      subject: parsed.subject,
      attendees: {
        create: attendeeUsers.map((u) => ({ userId: u.id })),
      },
    },
    include: {
      room: true,
      booker: { select: { name: true, email: true } },
    },
  });

  // 發送會議通知信（失敗不擋主流程）；即使沒有其他與會人也寄給發起者
  if (booking.booker.email) {
    try {
      const result = await sendMeetingBookingMail({
        bookingId: booking.id,
        subject: booking.subject,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        roomName: booking.room.name,
        roomLocation: booking.room.location,
        booker: {
          name: booking.booker.name,
          email: booking.booker.email,
        },
        attendees: attendeeUsers.map((u) => ({
          name: u.name,
          email: u.email,
        })),
      });
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "MEETING_MAIL_SENT",
          target: booking.id,
          detail: result?.recipientEmails.join(", "),
        },
      }).catch(() => {});
    } catch (err) {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "MEETING_MAIL_FAILED",
          target: booking.id,
          detail: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {});
    }
  }

  revalidatePath("/meeting");

  return { id: booking.id };
}

export async function cancelMeetingBooking(bookingId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const isAdmin = session.user.role === "ADMIN";

  const booking = await prisma.meetingBooking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      room: true,
      booker: { select: { id: true, name: true, email: true } },
      attendees: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  // 發起者本人或管理員都能取消
  if (booking.bookerId !== session.user.id && !isAdmin) {
    throw new Error("只能取消自己的預約");
  }

  if (booking.isCancelled) {
    throw new Error("此預約已取消");
  }

  await prisma.meetingBooking.update({
    where: { id: bookingId },
    data: { isCancelled: true },
  });

  const cancelledByAdmin = isAdmin && booking.bookerId !== session.user.id;

  // 查執行取消者資料
  const canceller = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  // 寄取消通知（失敗不擋主流程）
  if (booking.booker.email) {
    try {
      const result = await sendMeetingCancelMail({
        bookingId: booking.id,
        subject: booking.subject,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        roomName: booking.room.name,
        roomLocation: booking.room.location,
        booker: {
          name: booking.booker.name,
          email: booking.booker.email,
        },
        attendees: booking.attendees.map((a) => ({
          name: a.user.name,
          email: a.user.email,
        })),
        cancelledBy: canceller,
        cancelledByAdmin,
      });
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "MEETING_CANCELLED",
          target: booking.id,
          detail: JSON.stringify({
            byAdmin: cancelledByAdmin,
            subject: booking.subject,
            recipients: result?.recipientEmails,
          }),
        },
      }).catch(() => {});
    } catch (err) {
      await prisma.systemLog.create({
        data: {
          userId: session.user.id,
          action: "MEETING_CANCEL_MAIL_FAILED",
          target: booking.id,
          detail: err instanceof Error ? err.message : String(err),
        },
      }).catch(() => {});
    }
  }

  revalidatePath("/meeting");
}

export async function getMeetingRooms() {
  return prisma.meetingRoom.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getMeetingBookingsForMonth(year: number, month: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const bookings = await prisma.meetingBooking.findMany({
    where: {
      date: { gte: start, lt: end },
      isCancelled: false,
    },
    include: {
      room: { select: { id: true, name: true } },
      booker: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // 將 Date 序列化為 string，避免 client 收到 Date object 問題
  return bookings.map((b) => ({
    ...b,
    date: b.date.toISOString(),
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function updateMeetingBooking(bookingId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const isAdmin = session.user.role === "ADMIN";

  const existing = await prisma.meetingBooking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  if (existing.bookerId !== session.user.id && !isAdmin) {
    throw new Error("只能編輯自己的預約");
  }
  if (existing.isCancelled) {
    throw new Error("此預約已取消");
  }

  const raw = {
    roomId: formData.get("roomId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    subject: formData.get("subject"),
    attendeeEmails: [],
  };

  const parsed = bookMeetingSchema.parse(raw);

  if (parsed.startTime >= parsed.endTime) {
    throw new Error("結束時間須晚於起始時間");
  }

  // 衝突檢查（排除自己）
  const conflicts = await prisma.meetingBooking.findMany({
    where: {
      id: { not: bookingId },
      roomId: parsed.roomId,
      date: parsed.date,
      isCancelled: false,
    },
  });

  if (conflicts.some((b) => isTimeOverlap(parsed.startTime, parsed.endTime, b.startTime, b.endTime))) {
    throw new Error("該時段已被預約");
  }

  await prisma.meetingBooking.update({
    where: { id: bookingId },
    data: {
      roomId: parsed.roomId,
      date: parsed.date,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      subject: parsed.subject,
    },
  });

  revalidatePath("/meeting");
}

export async function getMeetingRoomAvailability(roomId: string, date: Date) {
  return prisma.meetingBooking.findMany({
    where: {
      roomId,
      date,
      isCancelled: false,
    },
    include: { booker: { select: { name: true, email: true } } },
    orderBy: { startTime: "asc" },
  });
}
