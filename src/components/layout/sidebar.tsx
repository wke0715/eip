"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

interface SidebarUser {
  name?: string | null;
  email?: string | null;
}

interface SidebarProps {
  isAdmin?: boolean;
  companyName?: string;
  user?: SidebarUser;
  onSignOut?: () => void;
}

type NavConfig = {
  href: string;
  en: string;
  zh: string;
  num: string;
  badge?: boolean;
  icon: React.ReactNode;
};

const workspaceNav: NavConfig[] = [
  {
    href: "/",
    en: "Dashboard",
    zh: "儀表",
    num: "01",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    href: "/leave",
    en: "Leave",
    zh: "請假",
    num: "02",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" />
      </svg>
    ),
  },
  {
    href: "/expense",
    en: "Expense",
    zh: "差旅",
    num: "03",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 3 L 5 21 L 9 19 L 12 21 L 15 19 L 19 21 L 19 3 Z" />
        <line x1="9" y1="9" x2="15" y2="9" />
      </svg>
    ),
  },
  {
    href: "/other-expense",
    en: "Misc.",
    zh: "費用",
    num: "04",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    href: "/overtime",
    en: "Overtime",
    zh: "加班",
    num: "05",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
      </svg>
    ),
  },
  {
    href: "/meeting",
    en: "Rooms",
    zh: "會議室",
    num: "06",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 21 V 8 L 11 3 V 21" /><path d="M11 9 H 21 V 21" />
        <line x1="14" y1="13" x2="17" y2="13" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    en: "Calendar",
    zh: "行事曆",
    num: "07",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="5" width="18" height="16" rx="1" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" />
      </svg>
    ),
  },
];

const mailroomNav: NavConfig[] = [
  {
    href: "/inbox",
    en: "Inbox",
    zh: "收件",
    num: "08",
    badge: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5 5 L 2 12 V 19 H 22 V 12 L 19 5 Z" />
      </svg>
    ),
  },
  {
    href: "/outbox",
    en: "Outbox",
    zh: "寄件",
    num: "09",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
];

const adminNav: NavConfig[] = [
  {
    href: "/admin/users",
    en: "Users",
    zh: "人員",
    num: "A1",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    href: "/admin/workflow",
    en: "Workflow",
    zh: "流程",
    num: "A2",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
        <path d="M6 9v6" /><path d="M9 6h6a3 3 0 0 1 3 3v6" />
      </svg>
    ),
  },
  {
    href: "/admin/rooms",
    en: "Rooms",
    zh: "會議室",
    num: "A3",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="18" rx="1" />
        <line x1="8" y1="3" x2="8" y2="21" /><line x1="2" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    href: "/admin/smtp",
    en: "SMTP",
    zh: "郵件",
    num: "A4",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <polyline points="22 4 12 13 2 4" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    en: "Settings",
    zh: "設定",
    num: "A5",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    href: "/admin/logs",
    en: "Logs",
    zh: "日誌",
    num: "A6",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
];

function EditorialNavLink({ item, pathname }: { item: NavConfig; pathname: string }) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={`editorial-nav-item${isActive ? " active" : ""}`}
    >
      <span className="nav-icon">{item.icon}</span>
      <span>
        {item.en}{" "}
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "13px",
            color: "var(--ink-soft)",
            marginLeft: "4px",
          }}
        >
          {item.zh}
        </span>
      </span>
      <span className={`editorial-nav-num${item.badge ? " badge" : ""}`}>
        {item.num}
      </span>
    </Link>
  );
}

export function Sidebar({
  isAdmin = false,
  user,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const displayName = user?.name ?? user?.email ?? "使用者";
  const initial = displayName[0] ?? "?";
  const role = isAdmin ? "管理員 · ADMIN" : "成員 · MEMBER";

  return (
    <aside
      className="hidden md:flex flex-col"
      style={{
        width: "280px",
        flexShrink: 0,
        borderRight: "1px solid var(--line)",
        padding: "32px 28px",
        background: "linear-gradient(180deg, var(--paper-2) 0%, var(--paper) 100%)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "48px" }}>
        <svg
          width="44"
          height="56"
          viewBox="0 0 44 56"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: "var(--bronze)" }}
          aria-hidden="true"
        >
          <line x1="22" y1="2" x2="22" y2="6" />
          <ellipse cx="22" cy="8" rx="9" ry="2" />
          <path d="M13 10 C 8 16, 8 26, 12 32 L 32 32 C 36 26, 36 16, 31 10" />
          <line x1="13" y1="20" x2="31" y2="20" strokeDasharray="2 2" opacity="0.5" />
          <path d="M30 14 L 40 12 L 36 18" />
          <path d="M13 16 C 6 18, 6 24, 13 26" />
          <line x1="14" y1="32" x2="11" y2="44" />
          <line x1="22" y1="32" x2="22" y2="46" />
          <line x1="30" y1="32" x2="33" y2="44" />
          <line x1="9" y1="48" x2="35" y2="48" strokeWidth="0.8" />
        </svg>
        <div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "24px",
              fontWeight: 600,
              lineHeight: 1,
              fontStyle: "italic",
              letterSpacing: "-0.01em",
              marginBottom: "4px",
            }}
          >
            Hé · 盉
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "14px",
              color: "var(--ink-soft)",
              letterSpacing: "0.4em",
            }}
          >
            企盉顧問
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            color: "var(--bronze)",
            marginBottom: "12px",
            fontWeight: 600,
          }}
        >
          Workspace
        </div>
        {workspaceNav.map((item) => (
          <EditorialNavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            color: "var(--bronze)",
            margin: "28px 0 12px",
            fontWeight: 600,
          }}
        >
          Mailroom
        </div>
        {mailroomNav.map((item) => (
          <EditorialNavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {isAdmin && (
          <>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.24em",
                color: "var(--bronze)",
                margin: "28px 0 12px",
                fontWeight: 600,
              }}
            >
              Admin
            </div>
            {adminNav.map((item) => (
              <EditorialNavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "24px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--bronze) 0%, var(--bronze-deep, #5a3a1d) 100%)",
            color: "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-heading)",
            fontSize: "14px",
            fontWeight: 600,
            fontStyle: "italic",
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--ink-soft)",
              marginTop: "2px",
              letterSpacing: "0.05em",
            }}
          >
            {role}
          </div>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-soft)",
              opacity: 0.6,
              padding: "4px",
              flexShrink: 0,
            }}
            title="登出"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}
