"use client";

import { useTransition, useState } from "react";
import {
  createMeetingRoom,
  updateMeetingRoom,
  toggleMeetingRoomStatus,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus } from "lucide-react";

interface Room {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  isActive: boolean;
}

export function RoomManager({ rooms }: { readonly rooms: readonly Room[] }) {
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createMeetingRoom(formData);
        setCreateOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "新增失敗");
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateMeetingRoom(formData);
        setEditingRoom(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新失敗");
      }
    });
  }

  function handleToggle(room: Room) {
    const action = room.isActive ? "停用" : "啟用";
    if (!confirm(`確定要${action}「${room.name}」？`)) return;
    startTransition(async () => {
      try {
        await toggleMeetingRoomStatus(room.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "操作失敗");
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { setError(null); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          新增會議室
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              尚未設定任何會議室
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名稱</TableHead>
                  <TableHead>地點</TableHead>
                  <TableHead>容納人數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>{room.location ?? "-"}</TableCell>
                    <TableCell>
                      {room.capacity == null ? "-" : `${room.capacity} 人`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={room.isActive ? "default" : "secondary"}>
                        {room.isActive ? "啟用中" : "已停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setError(null); setEditingRoom(room); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={room.isActive ? "outline" : "default"}
                          disabled={isPending}
                          onClick={() => handleToggle(room)}
                        >
                          {room.isActive ? "停用" : "啟用"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增會議室</DialogTitle>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">名稱</Label>
              <Input id="create-name" name="name" required placeholder="例：大型會議室 A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-location">地點（選填）</Label>
              <Input id="create-location" name="location" placeholder="例：3F" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-capacity">容納人數（選填）</Label>
              <Input
                id="create-capacity"
                name="capacity"
                type="number"
                min={1}
                placeholder="例：10"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                新增
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 編輯 Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={(o) => !o && setEditingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯會議室</DialogTitle>
          </DialogHeader>
          {editingRoom && (
            <form action={handleUpdate} className="space-y-4">
              <input type="hidden" name="id" value={editingRoom.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-name">名稱</Label>
                <Input
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={editingRoom.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">地點（選填）</Label>
                <Input
                  id="edit-location"
                  name="location"
                  defaultValue={editingRoom.location ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-capacity">容納人數（選填）</Label>
                <Input
                  id="edit-capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  defaultValue={editingRoom.capacity ?? ""}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRoom(null)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isPending}>
                  儲存
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
