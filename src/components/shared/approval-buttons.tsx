"use client";

import { useTransition } from "react";
import { approveForm, rejectForm } from "@/actions/approval";
import { Button } from "@/components/ui/button";

export function ApprovalButtons({ submissionId }: { submissionId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(() => approveForm(submissionId))
        }
      >
        核准
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          const comment = prompt("退簽原因（選填）：");
          startTransition(() =>
            rejectForm(submissionId, comment ?? undefined)
          );
        }}
      >
        退簽
      </Button>
    </div>
  );
}
