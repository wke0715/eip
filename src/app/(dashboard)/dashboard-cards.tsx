import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Clock, CheckCircle2, XCircle } from "lucide-react";

interface DashboardCardsProps {
  pendingCount: number;
  inProgressCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const cards = [
  { key: "pending",    label: "待簽核", icon: ClipboardCheck, color: "text-yellow-600", href: "/inbox" },
  { key: "inProgress", label: "簽核中", icon: Clock,          color: "text-blue-600",   href: "/outbox?tab=pending" },
  { key: "approved",   label: "已結案", icon: CheckCircle2,   color: "text-green-600",  href: "/outbox?tab=approved" },
  { key: "rejected",   label: "被退簽", icon: XCircle,        color: "text-red-600",    href: "/outbox?tab=rejected" },
] as const;

export function DashboardCards(props: DashboardCardsProps) {
  const counts = {
    pending:    props.pendingCount,
    inProgress: props.inProgressCount,
    approved:   props.approvedCount,
    rejected:   props.rejectedCount,
  };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.key} href={card.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts[card.key]}</div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
