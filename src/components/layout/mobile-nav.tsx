"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { userNavItems, adminNavItems, type NavItem } from "@/lib/navigation";

function MobileNavLink({
  item,
  pathname,
  onClose,
}: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
}) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
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

interface MobileNavProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly isAdmin?: boolean;
  readonly companyName?: string;
}

export function MobileNav({
  isOpen,
  onClose,
  isAdmin = false,
  companyName = "企盉 EIP",
}: MobileNavProps) {
  const pathname = usePathname();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-14 justify-center border-b px-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold tracking-wide">
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
            {companyName}
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 p-3">
          {userNavItems.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onClose={onClose}
            />
          ))}
          {isAdmin && (
            <>
              <Separator className="my-3" />
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                管理員
              </p>
              {adminNavItems.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onClose={onClose}
                />
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
