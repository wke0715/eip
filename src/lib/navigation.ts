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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const userNavItems: NavItem[] = [
  { label: "儀表板", href: "/dashboard", icon: LayoutDashboard },
  { label: "請假單", href: "/dashboard/leave", icon: FileText },
  { label: "會議室", href: "/dashboard/meeting", icon: DoorOpen },
  { label: "人員行事曆", href: "/dashboard/calendar", icon: Calendar },
  { label: "收件匣", href: "/dashboard/inbox", icon: Inbox },
  { label: "寄件匣", href: "/dashboard/outbox", icon: Send },
];

export const adminNavItems: NavItem[] = [
  { label: "人員管理", href: "/dashboard/admin/users", icon: Users },
  { label: "系統 Log", href: "/dashboard/admin/logs", icon: ScrollText },
  { label: "系統設定", href: "/dashboard/admin/settings", icon: Settings },
  { label: "SMTP 管理", href: "/dashboard/admin/smtp", icon: Mail },
  { label: "簽核流程", href: "/dashboard/admin/workflow", icon: GitBranch },
];
