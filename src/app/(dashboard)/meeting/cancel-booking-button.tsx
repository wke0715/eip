"use client";

import { useTransition } from "react";
import { cancelMeetingBooking } from "@/actions/meeting";
import { Button } from "@/components/ui/button";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        if (!confirm("確定要取消此預約嗎？")) return;
        startTransition(() => cancelMeetingBooking(bookingId));
      }}
    >
      取消
    </Button>
  );
}
