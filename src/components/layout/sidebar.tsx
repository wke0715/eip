"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { userNavItems, adminNavItems, type NavItem } from "@/lib/navigation";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar({
  isAdmin = false,
  companyName = "企盉 EIP",
}: {
  isAdmin?: boolean;
  companyName?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-52 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 56 56" aria-hidden="true">
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
          <span className="text-lg font-bold tracking-wide">{companyName}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {userNavItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        {isAdmin && (
          <>
            <Separator className="my-3" />
            <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              管理員
            </p>
            {adminNavItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
