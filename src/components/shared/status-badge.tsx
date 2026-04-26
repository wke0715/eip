import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  DRAFT: { label: "草稿", dot: "bg-gray-400", className: "bg-gray-100 text-gray-700 border-transparent" },
  PENDING: { label: "待簽核", dot: "bg-yellow-500", className: "bg-yellow-100 text-yellow-800 border-transparent" },
  APPROVED: { label: "已結案", dot: "bg-green-600", className: "bg-green-100 text-green-800 border-transparent" },
  REJECTED: { label: "被退簽", dot: "bg-red-600", className: "bg-red-100 text-red-800 border-transparent" },
} as const;

type FormStatus = keyof typeof statusConfig;

export function StatusBadge({ status }: { status: FormStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", config.className)}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}
