"use client";

import { ExpenseFormTable } from "@/components/shared/expense-form-table";
import type { SubmissionLike } from "@/lib/form-labels";

export function ExpenseTable({
  submissions,
}: {
  submissions: SubmissionLike[];
}) {
  return (
    <ExpenseFormTable
      submissions={submissions}
      formSlug="expense"
      emptyText="尚無報告單紀錄"
    />
  );
}
