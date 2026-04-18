"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmissionTable } from "@/components/shared/submission-table";
import { SubmissionDetailModal } from "@/components/shared/submission-detail-modal";
import { CancelSubmissionButton } from "@/components/shared/cancel-submission-button";
import { DeleteSubmissionButton } from "@/components/shared/delete-submission-button";
import { buttonVariants } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubmissionLike } from "@/lib/form-labels";

type LeaveSubmission = SubmissionLike;

export function LeaveTable({
  submissions,
}: {
  submissions: LeaveSubmission[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <SubmissionTable
        rows={submissions}
        variant="list"
        emptyText="尚無請假紀錄"
        onRowClick={(row) => {
          setSelectedId(row.id);
          setOpen(true);
        }}
        renderActions={(row) => {
          if (row.status === "PENDING") {
            return <CancelSubmissionButton submissionId={row.id} />;
          }
          if (row.status === "REJECTED") {
            return (
              <div className="flex gap-1.5">
                <Link
                  href={`/leave/resubmit/${row.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5",
                  )}
                >
                  <Pencil className="h-3 w-3" />
                  編輯重送
                </Link>
                <DeleteSubmissionButton
                  submissionId={row.id}
                  formType={row.formType}
                />
              </div>
            );
          }
          return null;
        }}
      />

      <SubmissionDetailModal
        submissionId={selectedId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
