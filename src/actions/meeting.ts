"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookMeetingSchema } from "@/lib/validators/meeting";
import { isTimeOverlap } from "@/lib/meeting-utils";
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
        select: { id: true },
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
  });

  revalidatePath("/dashboard/meeting");

  return { id: booking.id };
}

export async function cancelMeetingBooking(bookingId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");

  const booking = await prisma.meetingBooking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  if (booking.bookerId !== session.user.id) {
    throw new Error("只能取消自己的預約");
  }

  await prisma.meetingBooking.update({
    where: { id: bookingId },
    data: { isCancelled: true },
  });

  revalidatePath("/dashboard/meeting");
}

export async function getMeetingRooms() {
  return prisma.meetingRoom.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
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
