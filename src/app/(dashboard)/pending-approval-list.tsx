"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionTable } from "@/components/shared/submission-table";
import { ApprovalButtons } from "@/components/shared/approval-buttons";
import { SubmissionDetailModal } from "@/components/shared/submission-detail-modal";
import type { getInboxItems } from "@/actions/approval";

type PendingItem = Awaited<ReturnType<typeof getInboxItems>>["pendingApprovals"][number];

export function PendingApprovalList({ items }: { items: PendingItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submissions = items.map((item) => item.submission);

  function handleRowClick(submissionId: string) {
    setSelectedId(submissionId);
    setOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">代簽核清單</CardTitle>
        </CardHeader>
        <CardContent>
          <SubmissionTable
            rows={submissions}
            variant="inbox"
            emptyText="目前沒有待簽核的表單"
            onRowClick={(row) => handleRowClick(row.id)}
            renderActions={(row) => <ApprovalButtons submissionId={row.id} />}
          />
        </CardContent>
      </Card>

      <SubmissionDetailModal
        submissionId={selectedId}
        open={open}
        onOpenChange={setOpen}
        showApprovalButtons
      />
    </>
  );
}
