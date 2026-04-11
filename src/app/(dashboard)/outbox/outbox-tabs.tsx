"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";

type Tab = "pending" | "approved" | "rejected";

const tabs: { key: Tab; label: string }[] = [
  { key: "pending", label: "簽核中" },
  { key: "approved", label: "已結案" },
  { key: "rejected", label: "被退簽" },
];

interface Submission {
  id: string;
  formType: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  leaveRequest: {
    leaveType: { name: string };
    startDate: Date;
    endDate: Date;
    hours: number;
  } | null;
}

interface PendingSubmission extends Submission {
  approvalActions: Array<{
    stepOrder: number;
    action: string | null;
    approver: { name: string | null; email: string };
  }>;
}

interface OutboxTabsProps {
  pending: PendingSubmission[];
  approved: Submission[];
  rejected: Submission[];
}

function SubmissionTable({
  items,
  showProgress,
}: {
  items: (Submission | PendingSubmission)[];
  showProgress?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        沒有資料
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>表單類型</TableHead>
          <TableHead>起迄日期</TableHead>
          <TableHead>時數</TableHead>
          <TableHead>狀態</TableHead>
          {showProgress && <TableHead>簽核進度</TableHead>}
          <TableHead>申請日期</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((sub) => (
          <TableRow key={sub.id}>
            <TableCell>
              {sub.formType === "LEAVE"
                ? `請假 - ${sub.leaveRequest?.leaveType.name ?? ""}`
                : sub.formType}
            </TableCell>
            <TableCell>
              {sub.leaveRequest
                ? `${new Date(sub.leaveRequest.startDate).toLocaleDateString("zh-TW")} ~ ${new Date(sub.leaveRequest.endDate).toLocaleDateString("zh-TW")}`
                : "-"}
            </TableCell>
            <TableCell>{sub.leaveRequest?.hours ?? "-"}</TableCell>
            <TableCell>
              <StatusBadge status={sub.status} />
            </TableCell>
            {showProgress && "approvalActions" in sub && (
              <TableCell>
                <div className="text-xs text-muted-foreground">
                  {(sub as PendingSubmission).approvalActions.map((a) => (
                    <span key={a.stepOrder} className="mr-2">
                      第{a.stepOrder}關：
                      {a.approver.name ?? a.approver.email}{" "}
                      {a.action === "APPROVED"
                        ? "✓"
                        : a.action === "REJECTED"
                          ? "✗"
                          : "⏳"}
                    </span>
                  ))}
                </div>
              </TableCell>
            )}
            <TableCell>
              {new Date(sub.createdAt).toLocaleDateString("zh-TW")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function OutboxTabs({ pending, approved, rejected }: OutboxTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  const data = { pending, approved, rejected };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {data[tab.key].length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({data[tab.key].length})
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <SubmissionTable
            items={data[activeTab]}
            showProgress={activeTab === "pending"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
