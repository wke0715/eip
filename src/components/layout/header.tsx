"use client";

import { Menu, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Header({ user, onMenuClick, onSignOut }: HeaderProps) {
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : (user.email?.[0]?.toUpperCase() ?? "?");

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted transition-colors md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2 md:hidden">
          <svg width="24" height="24" viewBox="0 0 56 56" aria-hidden="true">
            <g transform="translate(8, 8)">
              <rect
                x="0"
                y="0"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="20"
                x2="40"
                y2="20"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="20"
                y1="20"
                x2="20"
                y2="40"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="10" cy="10" r="2" fill="currentColor" />
            </g>
          </svg>
          <span className="text-lg font-bold tracking-wide">企盉 EIP</span>
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors outline-none">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium">
            {user.name ?? user.email}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            登出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
