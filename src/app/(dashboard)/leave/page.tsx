import Link from "next/link";
import { getMyLeaveRequests } from "@/actions/leave";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { LeaveTable } from "./leave-table";

export default async function LeavePage() {
  const submissions = await getMyLeaveRequests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">請假單</h1>
        <Link href="/leave/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          新增請假單
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的請假紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveTable submissions={submissions} />
        </CardContent>
      </Card>
    </div>
  );
}
