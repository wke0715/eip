"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  applicantDisplay,
  formAmountOrHours,
  formNumber,
  formPeriod,
  formTypeLabel,
  type SubmissionLike,
} from "@/lib/form-labels";

export type SubmissionTableVariant = "list" | "inbox" | "outbox";

export interface SubmissionTableProps<T extends SubmissionLike> {
  rows: T[];
  variant?: SubmissionTableVariant;
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
  emptyText?: string;
}

export function SubmissionTable<T extends SubmissionLike>({
  rows,
  variant = "list",
  onRowClick,
  renderActions,
  emptyText = "沒有資料",
}: SubmissionTableProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {emptyText}
      </p>
    );
  }

  const showApplicant = variant === "inbox";
  const showActions = renderActions !== undefined;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>表單類型</TableHead>
          <TableHead>表單編號</TableHead>
          <TableHead>期間</TableHead>
          <TableHead>時數/金額</TableHead>
          <TableHead>狀態</TableHead>
          {showApplicant && <TableHead>申請人</TableHead>}
          <TableHead>申請日期</TableHead>
          {showActions && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const number = formNumber(row);
          const cancelledTag =
            row.cancelledByApplicant && row.status === "REJECTED";
          return (
            <TableRow
              key={row.id}
              className={
                onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined
              }
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <TableCell>{formTypeLabel(row)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {number ?? "-"}
              </TableCell>
              <TableCell>{formPeriod(row)}</TableCell>
              <TableCell>{formAmountOrHours(row)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.status} />
                  {cancelledTag && (
                    <span className="text-xs text-muted-foreground">
                      （已取回）
                    </span>
                  )}
                </div>
              </TableCell>
              {showApplicant && <TableCell>{applicantDisplay(row)}</TableCell>}
              <TableCell>
                {new Date(row.createdAt).toLocaleDateString("zh-TW")}
              </TableCell>
              {showActions && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {renderActions(row)}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
