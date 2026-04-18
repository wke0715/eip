"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { SubmissionTable } from "@/components/shared/submission-table";
import { SubmissionDetailModal } from "@/components/shared/submission-detail-modal";
import { CancelSubmissionButton } from "@/components/shared/cancel-submission-button";
import { DeleteSubmissionButton } from "@/components/shared/delete-submission-button";
import type { FormType } from "@prisma/client";
import type { getOutboxItems } from "@/actions/approval";

const resubmitPathByFormType: Record<FormType, string> = {
  LEAVE: "/leave/resubmit",
  EXPENSE: "/expense/resubmit",
  OVERTIME: "/overtime/resubmit",
  OTHER_EXPENSE: "/other-expense/resubmit",
};

type OutboxData = Awaited<ReturnType<typeof getOutboxItems>>;

type Tab = "pending" | "approved" | "rejected";

const tabs: { key: Tab; label: string }[] = [
  { key: "pending", label: "簽核中" },
  { key: "approved", label: "已結案" },
  { key: "rejected", label: "被退簽" },
];

interface OutboxTabsProps {
  pending: OutboxData["pending"];
  approved: OutboxData["approved"];
  rejected: OutboxData["rejected"];
  initialTab?: string;
}

function toValidTab(value?: string): Tab {
  if (value === "approved" || value === "rejected") return value;
  return "pending";
}

export function OutboxTabs({
  pending,
  approved,
  rejected,
  initialTab,
}: OutboxTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>(toValidTab(initialTab));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const counts = { pending: pending.length, approved: approved.length, rejected: rejected.length };

  function handleRowClick(id: string) {
    setSelectedId(id);
    setOpen(true);
  }

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
              {counts[tab.key] > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({counts[tab.key]})
                </span>
              )}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-4">
            {activeTab === "pending" && (
              <SubmissionTable
                rows={pending}
                variant="outbox"
                emptyText="沒有簽核中的表單"
                onRowClick={(row) => handleRowClick(row.id)}
                renderActions={(row) => (
                  <CancelSubmissionButton submissionId={row.id} />
                )}
              />
            )}

            {activeTab === "approved" && (
              <SubmissionTable
                rows={approved}
                variant="outbox"
                emptyText="沒有已結案的表單"
                onRowClick={(row) => handleRowClick(row.id)}
              />
            )}

            {activeTab === "rejected" && (
              <SubmissionTable
                rows={rejected}
                variant="outbox"
                emptyText="沒有被退簽的表單"
                onRowClick={(row) => handleRowClick(row.id)}
                renderActions={(row) => (
                  <div className="flex gap-2">
                    <Link href={`${resubmitPathByFormType[row.formType]}/${row.id}`}>
                      <button
                        className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm hover:bg-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        編輯重送
                      </button>
                    </Link>
                    <DeleteSubmissionButton
                      submissionId={row.id}
                      formType={row.formType}
                    />
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <SubmissionDetailModal
        submissionId={selectedId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
