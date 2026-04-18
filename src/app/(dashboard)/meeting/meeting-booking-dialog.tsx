"use client";

import { useTransition, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bookMeetingRoom,
  cancelMeetingBooking,
  updateMeetingBooking,
} from "@/actions/meeting";
import { generateTimeSlots } from "@/lib/meeting-utils";
import { AttendeePicker } from "./book/attendee-picker";

// ── Types ─────────────────────────────────────────────────────────────────────

type Room = {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
};
type User = { id: string; name: string | null; email: string };

export type BookingForDialog = {
  id: string;
  roomId: string;
  room: { id: string; name: string };
  bookerId: string;
  booker: { id: string; name: string | null; email: string };
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type MeetingDialogTarget =
  | { mode: "new"; date: string }
  | { mode: "view"; booking: BookingForDialog };

interface Props {
  target: MeetingDialogTarget | null;
  rooms: Room[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

const timeSlots = generateTimeSlots();

// ── Component ─────────────────────────────────────────────────────────────────

export function MeetingBookingDialog({
  target,
  rooms,
  users,
  currentUserId,
  isAdmin,
  onClose,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  // ── New booking ────────────────────────────────────────────────────────────

  if (target.mode === "new") {
    function handleBook(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(null);
      const formData = new FormData(e.currentTarget);
      startTransition(async () => {
        try {
          await bookMeetingRoom(formData);
          onSaved();
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "預約失敗");
        }
      });
    }

    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>預約會議室</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBook} className="space-y-4">
            {/* 會議室 */}
            <div className="space-y-2">
              <Label htmlFor="dlg-roomId">會議室</Label>
              <select
                id="dlg-roomId"
                name="roomId"
                required
                className={SELECT_CLS}
              >
                <option value="">請選擇會議室</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.location ? ` (${r.location})` : ""}
                    {r.capacity ? ` - ${r.capacity} 人` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 日期（預填，可改） */}
            <div className="space-y-2">
              <Label htmlFor="dlg-date">日期</Label>
              <Input
                id="dlg-date"
                name="date"
                type="date"
                required
                defaultValue={target.date}
              />
            </div>

            {/* 時間 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dlg-startTime">起始時間</Label>
                <select
                  id="dlg-startTime"
                  name="startTime"
                  required
                  className={SELECT_CLS}
                >
                  <option value="">選擇時間</option>
                  {timeSlots.slice(0, -1).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dlg-endTime">結束時間</Label>
                <select
                  id="dlg-endTime"
                  name="endTime"
                  required
                  className={SELECT_CLS}
                >
                  <option value="">選擇時間</option>
                  {timeSlots.slice(1).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 主題 */}
            <div className="space-y-2">
              <Label htmlFor="dlg-subject">會議主題</Label>
              <Input
                id="dlg-subject"
                name="subject"
                required
                maxLength={200}
                placeholder="請填寫會議主題"
              />
            </div>

            {/* 與會者 */}
            <AttendeePicker users={users} />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "預約中..." : "確認預約"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Edit / cancel ──────────────────────────────────────────────────────────

  const { booking } = target;
  const canEdit = booking.bookerId === currentUserId || isAdmin;
  const isOther = isAdmin && booking.bookerId !== currentUserId;
  const bookerName = booking.booker.name ?? booking.booker.email;
  const dateKey = booking.date.slice(0, 10);

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateMeetingBooking(booking.id, formData);
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "儲存失敗");
      }
    });
  }

  function handleCancel() {
    const msg = isOther
      ? `你正在以管理員身份取消 ${bookerName} 的會議「${booking.subject}」，確定嗎？`
      : "確定要取消此預約嗎？";
    if (!confirm(msg)) return;
    startTransition(async () => {
      await cancelMeetingBooking(booking.id);
      onSaved();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>編輯預約</DialogTitle>
        </DialogHeader>

        {/* 發起人（唯讀提示） */}
        <p className="text-xs text-muted-foreground -mt-1">
          發起人：{bookerName}
        </p>

        <form onSubmit={handleUpdate} className="space-y-4">
          {/* 會議室 */}
          <div className="space-y-2">
            <Label htmlFor="edit-roomId">會議室</Label>
            <select
              id="edit-roomId"
              name="roomId"
              required
              defaultValue={booking.roomId}
              disabled={!canEdit}
              className={SELECT_CLS}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.location ? ` (${r.location})` : ""}
                  {r.capacity ? ` - ${r.capacity} 人` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 日期 */}
          <div className="space-y-2">
            <Label htmlFor="edit-date">日期</Label>
            <Input
              id="edit-date"
              name="date"
              type="date"
              required
              defaultValue={dateKey}
              disabled={!canEdit}
            />
          </div>

          {/* 時間 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startTime">起始時間</Label>
              <select
                id="edit-startTime"
                name="startTime"
                required
                defaultValue={booking.startTime}
                disabled={!canEdit}
                className={SELECT_CLS}
              >
                {timeSlots.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endTime">結束時間</Label>
              <select
                id="edit-endTime"
                name="endTime"
                required
                defaultValue={booking.endTime}
                disabled={!canEdit}
                className={SELECT_CLS}
              >
                {timeSlots.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 主題 */}
          <div className="space-y-2">
            <Label htmlFor="edit-subject">會議主題</Label>
            <Input
              id="edit-subject"
              name="subject"
              required
              maxLength={200}
              defaultValue={booking.subject}
              disabled={!canEdit}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            {canEdit && (
              <>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "儲存中..." : "儲存"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleCancel}
                >
                  取消預約
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className={canEdit ? "" : "w-full"}
            >
              關閉
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
