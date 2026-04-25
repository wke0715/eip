"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface NotificationData {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

interface NotificationDetailModalProps {
  readonly notification: NotificationData | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function NotificationDetailModal({
  notification,
  open,
  onOpenChange,
}: NotificationDetailModalProps) {
  function handlePrint() {
    if (!notification) return;
    const win = window.open("", "_blank", "width=700,height=500");
    if (!win) return;
    win.document.title = notification.title;
    win.document.head.innerHTML = `<style>
      body { font-family: sans-serif; font-size: 14px; padding: 32px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 16px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
      .body { line-height: 1.8; }
    </style>`;
    win.document.body.innerHTML = `
      <h1>${notification.title}</h1>
      <p class="meta">時間：${new Date(notification.createdAt).toLocaleString("zh-TW")}</p>
      <p class="body">${notification.message}</p>
      <p style='color:#999;font-size:12px;margin-top:40px'>列印時間：${new Date().toLocaleString("zh-TW")}</p>
    `;
    win.focus();
    win.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{notification?.title ?? "通知詳情"}</DialogTitle>
        </DialogHeader>

        {notification && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed">{notification.message}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(notification.createdAt).toLocaleString("zh-TW")}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!notification}
          >
            <Printer className="mr-2 h-4 w-4" />
            列印
          </Button>
          <DialogClose render={<Button variant="ghost" />}>關閉</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
