"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionTable } from "@/components/shared/submission-table";
import { ApprovalButtons } from "@/components/shared/approval-buttons";
import { MarkReadButton } from "./mark-read-button";
import { SubmissionDetailModal } from "@/components/shared/submission-detail-modal";
import { NotificationDetailModal } from "@/components/shared/notification-detail-modal";
import type { getInboxItems } from "@/actions/approval";

type InboxData = Awaited<ReturnType<typeof getInboxItems>>;

type Tab = "pending" | "notifications" | "completed";

const tabs: { key: Tab; label: string }[] = [
  { key: "pending", label: "待簽核表單" },
  { key: "notifications", label: "通知表單" },
  { key: "completed", label: "已簽核表單" },
];

interface InboxTabsProps {
  pendingApprovals: InboxData["pendingApprovals"];
  notifications: InboxData["notifications"];
  completedApprovals: InboxData["completedApprovals"];
}

export function InboxTabs({
  pendingApprovals,
  notifications,
  completedApprovals,
}: InboxTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<
    InboxData["notifications"][number] | null
  >(null);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);

  function openSubmission(id: string) {
    setSelectedSubmissionId(id);
    setSubmissionModalOpen(true);
  }

  function openNotification(n: InboxData["notifications"][number]) {
    setSelectedNotification(n);
    setNotificationModalOpen(true);
  }

  const pendingSubmissions = pendingApprovals.map((item) => item.submission);
  const completedSubmissions = Array.from(
    new Map(
      completedApprovals.map((item) => [item.submission.id, item.submission]),
    ).values(),
  );

  return (
    <>
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
              <SubmissionTable
                rows={pendingSubmissions}
                variant="inbox"
                emptyText="沒有待簽核的表單"
                onRowClick={(row) => openSubmission(row.id)}
                renderActions={(row) => (
                  <ApprovalButtons submissionId={row.id} />
                )}
              />
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
                      <button
                        key={n.id}
                        type="button"
                        className={cn(
                          "w-full flex items-start justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors text-left",
                          !n.isRead && "bg-muted/50"
                        )}
                        onClick={() => openNotification(n)}
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
                        {!n.isRead && (
                          <div
                            role="none"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <MarkReadButton notificationId={n.id} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "completed" && (
              <SubmissionTable
                rows={completedSubmissions}
                variant="inbox"
                emptyText="沒有已簽核的紀錄"
                onRowClick={(row) => openSubmission(row.id)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <SubmissionDetailModal
        submissionId={selectedSubmissionId}
        open={submissionModalOpen}
        onOpenChange={setSubmissionModalOpen}
        showApprovalButtons={activeTab === "pending"}
      />

      <NotificationDetailModal
        notification={selectedNotification}
        open={notificationModalOpen}
        onOpenChange={setNotificationModalOpen}
      />
    </>
  );
}
