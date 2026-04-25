"use client";

import { ExpenseFormTable } from "@/components/shared/expense-form-table";
import type { SubmissionLike } from "@/lib/form-labels";

export function OvertimeTable({
  submissions,
}: {
  readonly submissions: readonly SubmissionLike[];
}) {
  return (
    <ExpenseFormTable
      submissions={submissions}
      formSlug="overtime"
      emptyText="尚無加班單紀錄"
    />
  );
}
