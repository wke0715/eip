"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { bookMeetingRoom } from "@/actions/meeting";
import { generateTimeSlots } from "@/lib/meeting-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface Room {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
}

const timeSlots = generateTimeSlots();

export function BookMeetingForm({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await bookMeetingRoom(formData);
        router.push("/dashboard/meeting");
      } catch (e) {
        setError(e instanceof Error ? e.message : "預約失敗");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomId">會議室</Label>
            <select
              id="roomId"
              name="roomId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">請選擇會議室</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                  {room.location ? ` (${room.location})` : ""}
                  {room.capacity ? ` - ${room.capacity} 人` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">日期</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">起始時間</Label>
              <select
                id="startTime"
                name="startTime"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
              <Label htmlFor="endTime">結束時間</Label>
              <select
                id="endTime"
                name="endTime"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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

          <div className="space-y-2">
            <Label htmlFor="subject">會議主題</Label>
            <Input
              id="subject"
              name="subject"
              required
              maxLength={200}
              placeholder="請填寫會議主題"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attendeeEmails">
              與會者 Email（選填，一行一個）
            </Label>
            <textarea
              id="attendeeEmails"
              name="attendeeEmails"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground"
              placeholder={"user1@example.com\nuser2@example.com"}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "預約中..." : "確認預約"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
