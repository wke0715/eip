"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  users: User[];
}

export function AttendeePicker({ users }: Props) {
  const [attendees, setAttendees] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addEmail(email: string) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(trimmed)) return;
    if (attendees.includes(trimmed)) return;
    setAttendees((prev) => [...prev, trimmed]);
    setInputValue("");
    inputRef.current?.focus();
  }

  function removeAttendee(email: string) {
    setAttendees((prev) => prev.filter((e) => e !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail(inputValue);
    }
  }

  function handleSelectUser(e: React.ChangeEvent<HTMLSelectElement>) {
    const email = e.target.value;
    if (email) {
      addEmail(email);
      e.target.value = "";
    }
  }

  // 排除已加入的使用者
  const availableUsers = users.filter((u) => !attendees.includes(u.email));

  return (
    <div className="space-y-2">
      <Label>與會者（選填）</Label>

      {/* 下拉選現有使用者 */}
      {availableUsers.length > 0 && (
        <select
          onChange={handleSelectUser}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs text-muted-foreground"
          defaultValue=""
        >
          <option value="" disabled>
            選擇系統使用者...
          </option>
          {availableUsers.map((u) => (
            <option key={u.id} value={u.email}>
              {u.name ? `${u.name}（${u.email}）` : u.email}
            </option>
          ))}
        </select>
      )}

      {/* 手動輸入 Email */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="手動輸入 Email，按 Enter 新增"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addEmail(inputValue)}
        >
          新增
        </Button>
      </div>

      {/* 已選標籤 */}
      {attendees.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {attendees.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium"
            >
              {email}
              <button
                type="button"
                onClick={() => removeAttendee(email)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                aria-label={`移除 ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 隱藏欄位送出資料 */}
      {attendees.map((email) => (
        <input key={email} type="hidden" name="attendeeEmails" value={email} />
      ))}
    </div>
  );
}
