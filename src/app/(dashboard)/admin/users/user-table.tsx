"use client";

import { useTransition, useState } from "react";
import { updateUser } from "@/actions/admin";
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

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  department: { id: string; name: string } | null;
  manager: { id: string; name: string | null; email: string } | null;
}

interface Props {
  users: User[];
  departments: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; name: string | null; email: string }>;
}

export function UserTable({ users, departments, managers }: Props) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUser(formData);
        setEditingUser(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新失敗");
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
                  <TableHead>部門</TableHead>
                  <TableHead>主管</TableHead>
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
                    <TableCell>{user.department?.name ?? "-"}</TableCell>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingUser(user)}
                      >
                        編輯
                      </Button>
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
            <form action={handleUpdate} className="space-y-4">
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
                <Label>部門</Label>
                <select
                  name="departmentId"
                  defaultValue={editingUser.department?.id ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="">未指定</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
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
