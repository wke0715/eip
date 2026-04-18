"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ErrorDialog({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>無法送出</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {message}
        </p>
        <DialogFooter>
          <Button onClick={onClose}>確定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
