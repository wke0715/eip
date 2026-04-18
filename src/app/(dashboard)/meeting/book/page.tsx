import { prisma } from "@/lib/prisma";
import { getMeetingRooms } from "@/actions/meeting";
import { BookMeetingForm } from "./book-meeting-form";

export default async function BookMeetingPage() {
  const [rooms, users] = await Promise.all([
    getMeetingRooms(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">預約會議室</h1>
      <BookMeetingForm rooms={rooms} users={users} />
    </div>
  );
}
