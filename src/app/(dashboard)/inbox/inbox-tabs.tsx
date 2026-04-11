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
import { ApprovalButtons } from "@/components/shared/approval-buttons";
import { MarkReadButton } from "./mark-read-button";

type Tab = "pending" | "notifications" | "completed";

const tabs: { key: Tab; label: string }[] = [
  { key: "pending", label: "代簽核表單" },
  { key: "notifications", label: "通知表單" },
  { key: "completed", label: "已簽核表單" },
];

interface InboxTabsProps {
  pendingApprovals: Array<{
    id: string;
    submission: {
      id: string;
      formType: string;
      status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
      createdAt: Date;
      applicant: { name: string | null; email: string };
      leaveRequest: { leaveType: { name: string } } | null;
    };
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
  }>;
  completedApprovals: Array<{
    id: string;
    action: string | null;
    actedAt: Date | null;
    submission: {
      id: string;
      formType: string;
      status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
      applicant: { name: string | null; email: string };
      leaveRequest: { leaveType: { name: string } } | null;
    };
  }>;
}

export function InboxTabs({
  pendingApprovals,
  notifications,
  completedApprovals,
}: InboxTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pending");

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
            {tab.key === "pending" && pendingApprovals.length > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          {activeTab === "pending" && (
            <>
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  沒有待簽核的表單
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
                    {pendingApprovals.map((item) => (
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
                          {new Date(item.submission.createdAt).toLocaleDateString("zh-TW")}
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
            </>
          )}

          {activeTab === "notifications" && (
            <>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  沒有通知
                </p>
              ) : (
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start justify-between rounded-lg border p-3",
                        !n.isRead && "bg-muted/50"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {n.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleString("zh-TW")}
                        </p>
                      </div>
                      {!n.isRead && <MarkReadButton notificationId={n.id} />}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "completed" && (
            <>
              {completedApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  沒有已簽核的紀錄
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>表單類型</TableHead>
                      <TableHead>申請人</TableHead>
                      <TableHead>簽核結果</TableHead>
                      <TableHead>簽核時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedApprovals.map((item) => (
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
                          <StatusBadge
                            status={
                              item.action === "APPROVED"
                                ? "APPROVED"
                                : "REJECTED"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {item.actedAt
                            ? new Date(item.actedAt).toLocaleString("zh-TW")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
