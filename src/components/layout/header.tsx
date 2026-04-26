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
          <svg
            width="22"
            height="28"
            viewBox="0 0 44 56"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="22" y2="6" />
            <ellipse cx="22" cy="8" rx="9" ry="2" />
            <path d="M13 10 C 8 16, 8 26, 12 32 L 32 32 C 36 26, 36 16, 31 10" />
            <line
              x1="13"
              y1="20"
              x2="31"
              y2="20"
              strokeDasharray="2 2"
              opacity="0.5"
            />
            <path d="M30 14 L 40 12 L 36 18" />
            <path d="M13 16 C 6 18, 6 24, 13 26" />
            <line x1="14" y1="32" x2="11" y2="44" />
            <line x1="22" y1="32" x2="22" y2="46" />
            <line x1="30" y1="32" x2="33" y2="44" />
            <line x1="9" y1="48" x2="35" y2="48" strokeWidth="0.8" />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "18px",
              fontWeight: 600,
              fontStyle: "italic",
              letterSpacing: "-0.01em",
            }}
          >
            Hé · 盉
          </span>
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
