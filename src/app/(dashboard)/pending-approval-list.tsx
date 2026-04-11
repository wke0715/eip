"use client";

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
import { ApprovalButtons } from "@/components/shared/approval-buttons";

interface PendingItem {
  id: string;
  submission: {
    id: string;
    formType: string;
    status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
    createdAt: Date;
    applicant: { name: string | null; email: string };
    leaveRequest: {
      leaveType: { name: string };
    } | null;
  };
}

export function PendingApprovalList({ items }: { items: PendingItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">代簽核清單</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            目前沒有待簽核的表單
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>表單類型</TableHead>
                <TableHead>申請人</TableHead>
                <TableHead>申請日期</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.submission.formType === "LEAVE"
                      ? `請假 - ${item.submission.leaveRequest?.leaveType.name ?? ""}`
                      : item.submission.formType}
                  </TableCell>
                  <TableCell>
                    {item.submission.applicant.name ??
                      item.submission.applicant.email}
                  </TableCell>
                  <TableCell>
                    {new Date(item.submission.createdAt).toLocaleDateString(
                      "zh-TW"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.submission.status} />
                  </TableCell>
                  <TableCell>
                    <ApprovalButtons submissionId={item.submission.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
