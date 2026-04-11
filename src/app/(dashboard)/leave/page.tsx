import Link from "next/link";
import { getMyLeaveRequests } from "@/actions/leave";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus } from "lucide-react";

export default async function LeavePage() {
  const submissions = await getMyLeaveRequests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">請假單</h1>
        <Link href="/dashboard/leave/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          新增請假單
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的請假紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              尚無請假紀錄
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>假別</TableHead>
                  <TableHead>起始日期</TableHead>
                  <TableHead>結束日期</TableHead>
                  <TableHead>時數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>申請日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      {sub.leaveRequest?.leaveType.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {sub.leaveRequest
                        ? new Date(sub.leaveRequest.startDate).toLocaleDateString("zh-TW")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {sub.leaveRequest
                        ? new Date(sub.leaveRequest.endDate).toLocaleDateString("zh-TW")
                        : "-"}
                    </TableCell>
                    <TableCell>{sub.leaveRequest?.hours ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={sub.status} />
                    </TableCell>
                    <TableCell>
                      {new Date(sub.createdAt).toLocaleDateString("zh-TW")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
