import { getInboxItems } from "@/actions/approval";
import { InboxTabs } from "./inbox-tabs";

export default async function InboxPage() {
  const { pendingApprovals, notifications, completedApprovals } =
    await getInboxItems();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">收件匣</h1>
      <InboxTabs
        pendingApprovals={pendingApprovals}
        notifications={notifications}
        completedApprovals={completedApprovals}
      />
    </div>
  );
}
