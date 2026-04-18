"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormType } from "@prisma/client";
import { deleteLeaveRequest } from "@/actions/leave";
import { deleteExpenseReport } from "@/actions/expense";
import { deleteOvertimeRequest } from "@/actions/overtime";
import { deleteOtherExpenseRequest } from "@/actions/otherExpense";
import { Button } from "@/components/ui/button";

export function DeleteSubmissionButton({
  submissionId,
  formType,
}: {
  submissionId: string;
  formType: FormType;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("確定要刪除此申請嗎？刪除後無法復原。")) return;
    startTransition(async () => {
      switch (formType) {
        case "LEAVE":
          await deleteLeaveRequest(submissionId);
          break;
        case "EXPENSE":
          await deleteExpenseReport(submissionId);
          break;
        case "OVERTIME":
          await deleteOvertimeRequest(submissionId);
          break;
        case "OTHER_EXPENSE":
          await deleteOtherExpenseRequest(submissionId);
          break;
      }
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? "刪除中..." : "刪除"}
    </Button>
  );
}
