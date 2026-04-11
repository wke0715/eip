"use client";

import { useTransition } from "react";
import { markNotificationRead } from "@/actions/notification";
import { Button } from "@/components/ui/button";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        startTransition(() => markNotificationRead(notificationId))
      }
    >
      已讀
    </Button>
  );
}
