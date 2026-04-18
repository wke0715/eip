import {
  LayoutDashboard,
  FileText,
  DoorOpen,
  Calendar,
  Inbox,
  Send,
  Users,
  ScrollText,
  Settings,
  Mail,
  GitBranch,
  Building2,
  Receipt,
  Wallet,
  Clock,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const userNavItems: NavItem[] = [
  { label: "儀表板", href: "/", icon: LayoutDashboard },
  { label: "請假單", href: "/leave", icon: FileText },
  { label: "出差旅費", href: "/expense", icon: Receipt },
  { label: "其他費用", href: "/other-expense", icon: Wallet },
  { label: "加班單", href: "/overtime", icon: Clock },
  { label: "會議室", href: "/meeting", icon: DoorOpen },
  { label: "人員行事曆", href: "/calendar", icon: Calendar },
  { label: "收件匣", href: "/inbox", icon: Inbox },
  { label: "寄件匣", href: "/outbox", icon: Send },
];

export const adminNavItems: NavItem[] = [
  { label: "人員管理", href: "/admin/users", icon: Users },
  { label: "系統 Log", href: "/admin/logs", icon: ScrollText },
  { label: "系統設定", href: "/admin/settings", icon: Settings },
  { label: "SMTP 管理", href: "/admin/smtp", icon: Mail },
  { label: "簽核流程", href: "/admin/workflow", icon: GitBranch },
  { label: "會議室管理", href: "/admin/rooms", icon: Building2 },
];
