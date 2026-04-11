import { getMeetingRooms } from "@/actions/meeting";
import { BookMeetingForm } from "./book-meeting-form";

export default async function BookMeetingPage() {
  const rooms = await getMeetingRooms();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">預約會議室</h1>
      <BookMeetingForm rooms={rooms} />
    </div>
  );
}
