import { getDashboardStats } from "@/actions/notification";
import { getInboxItems } from "@/actions/approval";
import { DashboardCards } from "./dashboard-cards";
import { DashboardChart } from "./dashboard-chart";
import { PendingApprovalList } from "./pending-approval-list";

export default async function DashboardPage() {
  const [stats, inbox] = await Promise.all([
    getDashboardStats(),
    getInboxItems(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">儀表板</h1>

      <DashboardCards
        pendingCount={stats.pendingCount}
        inProgressCount={stats.inProgressCount}
        approvedCount={stats.approvedCount}
        rejectedCount={stats.rejectedCount}
      />

      <DashboardChart trendData={stats.trendData} />

      <PendingApprovalList items={stats.pendingCount > 0 ? inbox.pendingApprovals : []} />
    </div>
  );
}
