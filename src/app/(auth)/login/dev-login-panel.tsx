"use client";

import { useState } from "react";

interface DevUser {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "USER";
}

export function DevLoginPanel({
  users,
}: {
  readonly users: readonly DevUser[];
}) {
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");

  if (users.length === 0) {
    return (
      <p className="text-xs text-center text-muted-foreground">
        DB 尚無使用者，請先 seed 或新增
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-center text-muted-foreground">
        開發模式快速登入
      </p>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            [{u.role}] {u.name ?? u.email}
          </option>
        ))}
      </select>
      <a
        href={`/api/dev-login?userId=${selectedId}`}
        className="flex w-full items-center justify-center rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
      >
        以此身份登入
      </a>
    </div>
  );
}
