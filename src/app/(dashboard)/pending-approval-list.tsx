"use client";

import { useState } from "react";
import { SubmissionDetailModal } from "@/components/shared/submission-detail-modal";
import { ApprovalButtons } from "@/components/shared/approval-buttons";
import type { getInboxItems } from "@/actions/approval";

type PendingItem = Awaited<ReturnType<typeof getInboxItems>>["pendingApprovals"][number];

const ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

function toRoman(n: number): string {
  return ROMANS[n - 1] ?? String(n);
}

type FormType = "LEAVE" | "EXPENSE" | "OTHER_EXPENSE" | "OVERTIME";

const tagConfig: Record<FormType, { en: string; zh: string; bg: string; color: string }> = {
  LEAVE:         { en: "Leave",   zh: "假", bg: "rgba(74,104,85,0.12)",   color: "var(--patina)" },
  EXPENSE:       { en: "Expense", zh: "旅", bg: "rgba(176,138,60,0.15)",  color: "var(--gold)" },
  OVERTIME:      { en: "Overtime",zh: "班", bg: "rgba(184,68,58,0.10)",   color: "var(--vermillion)" },
  OTHER_EXPENSE: { en: "Misc",    zh: "雜", bg: "rgba(139,90,43,0.10)",   color: "var(--bronze)" },
};

function getSubtitle(item: PendingItem["submission"]): string {
  if (item.leaveRequest) {
    const lr = item.leaveRequest;
    const from = new Date(lr.startDate).toLocaleDateString("zh-TW");
    const to   = new Date(lr.endDate).toLocaleDateString("zh-TW");
    return `${from} — ${to}`;
  }
  if (item.expenseReport) {
    return `NT$ ${Number(item.expenseReport.totalAmount ?? 0).toLocaleString()}`;
  }
  if (item.overtimeRequest) {
    const or = item.overtimeRequest;
    return `${or.year} 年 ${or.month} 月 · ${or.totalOvertimeHours} 小時`;
  }
  if (item.otherExpenseRequest) {
    return `NT$ ${Number(item.otherExpenseRequest.totalAmount ?? 0).toLocaleString()}`;
  }
  return "";
}

function FormTag({ type }: { type: string }) {
  const cfg = tagConfig[type as FormType] ?? tagConfig.OTHER_EXPENSE;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        padding: "4px 10px",
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.en} {cfg.zh}
    </span>
  );
}

export function PendingApprovalList({ items }: { items: PendingItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "48px 0",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.15em",
          color: "var(--ink-soft)",
          opacity: 0.6,
          textTransform: "uppercase",
          borderBottom: "1px solid var(--line)",
        }}
      >
        — No items pending —
      </div>
    );
  }

  return (
    <>
      {items.map((item, idx) => {
        const sub = item.submission;
        const name = sub.applicant?.name ?? sub.applicant?.email ?? "未知";
        const subtitle = getSubtitle(sub);

        return (
          <div
            key={sub.id}
            className="editorial-queue-row"
            onClick={() => { setSelectedId(sub.id); setOpen(true); }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--bronze)",
                fontFeatureSettings: "'tnum'",
              }}
            >
              {toRoman(idx + 1)}.
            </span>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "19px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  marginBottom: "4px",
                }}
              >
                {sub.leaveRequest?.leaveType?.name ??
                  (sub.formType === "EXPENSE" ? "出差旅費申請" :
                   sub.formType === "OVERTIME" ? "加班申請" :
                   sub.formType === "OTHER_EXPENSE" ? "其他費用申請" : "申請單")}{" "}
                <span
                  style={{
                    fontStyle: "italic",
                    color: "var(--ink-soft)",
                    fontWeight: 400,
                    fontSize: "14px",
                  }}
                >
                  — 由 {name} 提出
                </span>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {subtitle}
              </div>
            </div>
            <FormTag type={sub.formType} />
            <div className="editorial-queue-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        );
      })}

      {/* Approval buttons rendered outside the clickable row */}
      {selectedId && (
        <div style={{ display: "none" }}>
          <ApprovalButtons submissionId={selectedId} />
        </div>
      )}

      <SubmissionDetailModal
        submissionId={selectedId}
        open={open}
        onOpenChange={setOpen}
        showApprovalButtons
      />
    </>
  );
}
