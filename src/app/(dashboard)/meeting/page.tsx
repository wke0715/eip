import { auth } from "@/lib/auth";
import { getMeetingRooms } from "@/actions/meeting";
import { prisma } from "@/lib/prisma";
import { MeetingCalendar } from "./meeting-calendar";

export default async function MeetingPage() {
  const session = await auth();
  const [rooms, users] = await Promise.all([
    getMeetingRooms(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <MeetingCalendar
      rooms={rooms}
      users={users}
      currentUserId={session?.user?.id ?? ""}
      isAdmin={session?.user?.role === "ADMIN"}
    />
  );
}
