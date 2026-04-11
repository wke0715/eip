import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  DRAFT: { label: "草稿", className: "bg-gray-100 text-gray-700" },
  PENDING: { label: "簽核中", className: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "已結案", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "被退簽", className: "bg-red-100 text-red-700" },
} as const;

type FormStatus = keyof typeof statusConfig;

export function StatusBadge({ status }: { status: FormStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
