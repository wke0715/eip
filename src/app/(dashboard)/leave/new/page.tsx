import { getLeaveTypes } from "@/actions/leave";
import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { LeaveForm } from "./leave-form";

export default async function NewLeavePage() {
  const [leaveTypes, maxSizeMb] = await Promise.all([
    getLeaveTypes(),
    getMaxAttachmentSizeMb(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">新增請假單</h1>
      <LeaveForm leaveTypes={leaveTypes} defaultValues={{ maxSizeMb }} />
    </div>
  );
}
