import { getMeetingRoomsAdmin } from "@/actions/admin";
import { RoomManager } from "./room-manager";

export default async function AdminRoomsPage() {
  const rooms = await getMeetingRoomsAdmin();

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">會議室管理</h1>
      <RoomManager rooms={rooms} />
    </div>
  );
}
