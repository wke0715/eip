"use client";

import { ExpenseFormTable } from "@/components/shared/expense-form-table";
import type { SubmissionLike } from "@/lib/form-labels";

export function OtherExpenseTable({
  submissions,
}: {
  submissions: SubmissionLike[];
}) {
  return (
    <ExpenseFormTable
      submissions={submissions}
      formSlug="other-expense"
      emptyText="尚無申請單紀錄"
    />
  );
}
