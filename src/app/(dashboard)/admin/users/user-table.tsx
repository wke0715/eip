"use client";

import { useTransition, useState } from "react";
import { updateUser, deleteUser } from "@/actions/admin";
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
import { Pencil, Trash2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  manager: { id: string; name: string | null; email: string } | null;
}

interface Props {
  users: User[];
  managers: Array<{ id: string; name: string | null; email: string }>;
}

export function UserTable({ users, managers }: Props) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateUser(formData);
        setEditingUser(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新失敗");
      }
    });
  }

  function handleDelete(user: User) {
    if (!confirm(`確定要刪除「${user.name ?? user.email}」？此操作無法復原。`)) return;
    startTransition(async () => {
      try {
        await deleteUser(user.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "刪除失敗");
      }
    });
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              尚無使用者
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>直屬主管</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name ?? "-"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.manager?.name ?? user.manager?.email ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        {user.isActive ? "啟用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingUser(user)}
                          title="編輯"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(user)}
                          disabled={isPending}
                          title="刪除"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯使用者</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <input type="hidden" name="id" value={editingUser.id} />
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" defaultValue={editingUser.email} required />
              </div>
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input
                  name="name"
                  defaultValue={editingUser.name ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <select
                  name="role"
                  defaultValue={editingUser.role}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>直屬主管</Label>
                <select
                  name="managerId"
                  defaultValue={editingUser.manager?.id ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">未指定</option>
                  {managers
                    .filter((m) => m.id !== editingUser.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name ?? m.email}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>狀態</Label>
                <select
                  name="isActive"
                  defaultValue={editingUser.isActive ? "true" : "false"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="true">啟用</option>
                  <option value="false">停用</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "儲存中..." : "儲存"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
