"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSubmission } from "@/actions/approval";
import { Button } from "@/components/ui/button";

export function CancelSubmissionButton({
  submissionId,
}: {
  submissionId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("確定要取回此申請嗎？取回後可編輯重送或刪除。")) return;
    startTransition(async () => {
      await cancelSubmission(submissionId);
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
      {isPending ? "取回中..." : "取回"}
    </Button>
  );
}
