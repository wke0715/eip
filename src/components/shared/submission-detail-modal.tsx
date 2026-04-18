"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { getSubmissionDetail } from "@/actions/approval";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApprovalButtons } from "@/components/shared/approval-buttons";

type SubmissionDetail = Awaited<ReturnType<typeof getSubmissionDetail>>;

const actionLabel: Record<string, string> = {
  APPROVED: "✓ 已核准",
  REJECTED: "✗ 已退簽",
};

type ApprovalAction = Awaited<ReturnType<typeof getSubmissionDetail>>["approvalActions"][number];

function groupByRound(actions: ApprovalAction[]): Map<number, ApprovalAction[]> {
  const map = new Map<number, ApprovalAction[]>();
  for (const a of actions) {
    const r = a.round ?? 1;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(a);
  }
  return map;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="col-span-2 text-sm">{value}</span>
    </div>
  );
}

function PrintContent({ data }: { data: SubmissionDetail }) {
  const lr = data.leaveRequest;
  const er = data.expenseReport;
  const oe = data.otherExpenseRequest;
  const ot = data.overtimeRequest;
  const isExpense = data.formType === "EXPENSE";
  const isOtherExpense = data.formType === "OTHER_EXPENSE";
  const isOvertime = data.formType === "OVERTIME";
  const pageTitle = isExpense
    ? "出差旅費報告單詳情"
    : isOtherExpense
      ? "其他費用申請單詳情"
      : isOvertime
        ? "加班單詳情"
        : "請假單詳情";
  const statusMap: Record<string, string> = {
    DRAFT: "草稿",
    PENDING: "簽核中",
    APPROVED: "已結案",
    REJECTED: "被退簽",
  };

  return `
    <style>
      body { font-family: sans-serif; font-size: 14px; padding: 32px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 24px; }
      h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 6px 8px; vertical-align: top; }
      td:first-child { color: #555; width: 30%; }
      .items-table td, .items-table th { border: 1px solid #ddd; font-size: 12px; }
      .items-table td:first-child { width: auto; color: #111; }
      .step { margin: 6px 0; }
      .step-pending { color: #999; }
      .step-approved { color: #16a34a; }
      .step-rejected { color: #dc2626; }
    </style>
    <h1>${pageTitle}</h1>
    <table>
      <tr><td>申請人</td><td>${data.applicant.name ?? data.applicant.email}</td></tr>
      ${er ? `<tr><td>表單編號</td><td>${er.formNumber}</td></tr>` : ""}
      ${er ? `<tr><td>年月</td><td>${er.year} 年 ${er.month} 月</td></tr>` : ""}
      ${er ? `<tr><td>總金額</td><td>$${er.totalAmount.toLocaleString("zh-TW")}</td></tr>` : ""}
      ${er ? `<tr><td>總單據數</td><td>${er.totalReceipts}</td></tr>` : ""}
      ${oe ? `<tr><td>表單編號</td><td>${oe.formNumber}</td></tr>` : ""}
      ${oe ? `<tr><td>年月</td><td>${oe.year} 年 ${oe.month} 月</td></tr>` : ""}
      ${oe ? `<tr><td>總金額</td><td>$${oe.totalAmount.toLocaleString("zh-TW")}</td></tr>` : ""}
      ${oe ? `<tr><td>總單據數</td><td>${oe.totalReceipts}</td></tr>` : ""}
      ${ot ? `<tr><td>表單編號</td><td>${ot.formNumber}</td></tr>` : ""}
      ${ot ? `<tr><td>年月</td><td>${ot.year} 年 ${ot.month} 月</td></tr>` : ""}
      ${ot ? `<tr><td>總加班時數</td><td>${ot.totalOvertimeHours.toFixed(1)}h</td></tr>` : ""}
      ${ot ? `<tr><td>加班費合計</td><td>$${ot.totalOvertimePay.toLocaleString("zh-TW")}</td></tr>` : ""}
      ${lr ? `<tr><td>表單編號</td><td>${lr.formNumber}</td></tr>` : ""}
      ${lr ? `<tr><td>假別</td><td>${lr.leaveType.name}</td></tr>` : ""}
      ${lr ? `<tr><td>起始時間</td><td>${new Date(lr.startDate).toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</td></tr>` : ""}
      ${lr ? `<tr><td>結束時間</td><td>${new Date(lr.endDate).toLocaleString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</td></tr>` : ""}
      ${lr ? `<tr><td>時數</td><td>${lr.hours} 小時</td></tr>` : ""}
      ${lr ? `<tr><td>原因</td><td>${lr.reason}</td></tr>` : ""}
      ${data.attachment ? `<tr><td>附件</td><td>${data.attachment.fileName}</td></tr>` : ""}
      <tr><td>狀態</td><td>${statusMap[data.status] ?? data.status}</td></tr>
      <tr><td>申請日期</td><td>${new Date(data.createdAt).toLocaleDateString("zh-TW")}</td></tr>
    </table>
    <h2>簽核流程</h2>
    ${data.approvalActions.length === 0
      ? "<p style='color:#999'>無簽核流程</p>"
      : data.approvalActions.map((a) => `
        <div class="step ${!a.action ? "step-pending" : a.action === "APPROVED" ? "step-approved" : "step-rejected"}">
          第 ${a.stepOrder} 關：${a.approver.name ?? a.approver.email}
          ${a.action === "APPROVED" ? "✓ 已核准" : a.action === "REJECTED" ? "✗ 已退簽" : "⏳ 等待中"}
          ${a.actedAt ? `（${new Date(a.actedAt).toLocaleString("zh-TW")}）` : ""}
          ${a.comment ? `<br><span style='color:#555;padding-left:16px'>備註：${a.comment}</span>` : ""}
        </div>
      `).join("")
    }
    <p style='color:#999;font-size:12px;margin-top:40px'>列印時間：${new Date().toLocaleString("zh-TW")}</p>
  `;
}

interface SubmissionDetailModalProps {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showApprovalButtons?: boolean;
}

export function SubmissionDetailModal({
  submissionId,
  open,
  onOpenChange,
  showApprovalButtons = false,
}: SubmissionDetailModalProps) {
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && submissionId) {
      const id = submissionId;
      Promise.resolve().then(() => setLoading(true));
      getSubmissionDetail(id)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      queueMicrotask(() => setData(null));
    }
  }, [open, submissionId]);

  function handlePrint() {
    if (!data) return;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    const printTitle = data.formType === "EXPENSE" ? "出差旅費報告單詳情" : "請假單詳情";
    win.document.write(`<!DOCTYPE html><html><head><title>${printTitle}</title></head><body>${PrintContent({ data })}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const lr = data?.leaveRequest;
  const er = data?.expenseReport;
  const oe = data?.otherExpenseRequest;
  const ot = data?.overtimeRequest;
  const isExpense = data?.formType === "EXPENSE";
  const isOtherExpense = data?.formType === "OTHER_EXPENSE";
  const isOvertime = data?.formType === "OVERTIME";
  const title = isExpense
    ? "出差旅費報告單詳情"
    : isOtherExpense
      ? "其他費用申請單詳情"
      : isOvertime
        ? "加班單詳情"
        : "請假單詳情";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isExpense
            ? "max-w-5xl overflow-y-auto max-h-[90vh]"
            : isOtherExpense || isOvertime
              ? "max-w-3xl overflow-y-auto max-h-[90vh]"
              : "max-w-xl overflow-y-auto max-h-[90vh]"
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">載入中...</p>
        )}

        {!loading && data && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">基本資訊</p>
              <DetailRow label="申請人" value={data.applicant.name ?? data.applicant.email} />
              {lr && (
                <>
                  <DetailRow label="表單編號" value={lr.formNumber} />
                  <DetailRow label="假別" value={lr.leaveType.name} />
                  <DetailRow
                    label="起始時間"
                    value={new Date(lr.startDate).toLocaleString("zh-TW", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", hour12: false,
                    })}
                  />
                  <DetailRow
                    label="結束時間"
                    value={new Date(lr.endDate).toLocaleString("zh-TW", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", hour12: false,
                    })}
                  />
                  <DetailRow label="時數" value={`${lr.hours} 小時`} />
                  <DetailRow label="原因" value={lr.reason} />
                </>
              )}
              {er && (
                <>
                  <DetailRow label="表單編號" value={er.formNumber} />
                  <DetailRow label="年月" value={`${er.year} 年 ${er.month} 月`} />
                  <DetailRow
                    label="總金額"
                    value={`$${er.totalAmount.toLocaleString("zh-TW")}`}
                  />
                  <DetailRow label="總單據數" value={er.totalReceipts} />
                </>
              )}
              {ot && (
                <>
                  <DetailRow label="表單編號" value={ot.formNumber} />
                  <DetailRow label="年月" value={`${ot.year} 年 ${ot.month} 月`} />
                  <DetailRow label="總工作時數" value={`${ot.totalWorkHours.toFixed(1)}h`} />
                  <DetailRow label="總加班時數" value={`${ot.totalOvertimeHours.toFixed(1)}h`} />
                  <DetailRow label="加班費合計" value={`$${ot.totalOvertimePay.toLocaleString("zh-TW")}`} />
                </>
              )}
              {oe && (
                <>
                  <DetailRow label="表單編號" value={oe.formNumber} />
                  <DetailRow label="年月" value={`${oe.year} 年 ${oe.month} 月`} />
                  <DetailRow
                    label="總金額"
                    value={`$${oe.totalAmount.toLocaleString("zh-TW")}`}
                  />
                  <DetailRow label="總單據數" value={oe.totalReceipts} />
                </>
              )}
              {data.attachment && (
                <DetailRow
                  label="附件"
                  value={
                    <a
                      href={`/api/attachments/${data.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {data.attachment.fileName}
                    </a>
                  }
                />
              )}
              <DetailRow label="狀態" value={<StatusBadge status={data.status} />} />
              <DetailRow
                label="申請日期"
                value={new Date(data.createdAt).toLocaleDateString("zh-TW")}
              />
            </div>

            {er && er.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  明細（{er.items.length} 筆）
                </p>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="text-left">
                        <th className="p-2">日期</th>
                        <th className="p-2">類別</th>
                        <th className="p-2">工作項目/地點</th>
                        <th className="p-2 text-right">交通</th>
                        <th className="p-2 text-right">膳食</th>
                        <th className="p-2 text-right">其他</th>
                        <th className="p-2 text-right">小計</th>
                        <th className="p-2 text-right">單據</th>
                      </tr>
                    </thead>
                    <tbody>
                      {er.items.map((it) => {
                        const transport =
                          (it.mileageSubsidy ?? 0) +
                          (it.parkingFee ?? 0) +
                          (it.etcFee ?? 0) +
                          (it.gasFee ?? 0) +
                          (it.transportAmount ?? 0);
                        return (
                          <tr key={it.id} className="border-t">
                            <td className="p-2 whitespace-nowrap">
                              {new Date(it.date).toLocaleDateString("zh-TW")}
                            </td>
                            <td className="p-2">{it.workCategory}</td>
                            <td className="p-2">{it.workDetail}</td>
                            <td className="p-2 text-right">
                              ${transport.toLocaleString("zh-TW")}
                            </td>
                            <td className="p-2 text-right">
                              ${(it.mealAmount ?? 0).toLocaleString("zh-TW")}
                            </td>
                            <td className="p-2 text-right">
                              ${(it.otherAmount ?? 0).toLocaleString("zh-TW")}
                            </td>
                            <td className="p-2 text-right font-medium">
                              ${(it.subtotal ?? 0).toLocaleString("zh-TW")}
                            </td>
                            <td className="p-2 text-right">{it.receipts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ot && ot.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  明細（{ot.items.length} 筆）
                </p>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="text-left">
                        <th className="p-2">日期</th>
                        <th className="p-2">加班人員</th>
                        <th className="p-2">客戶/工作內容</th>
                        <th className="p-2">類型</th>
                        <th className="p-2">工作時間</th>
                        <th className="p-2 text-right">工時</th>
                        <th className="p-2 text-right">加班</th>
                        <th className="p-2 text-right">加班費</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ot.items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2 whitespace-nowrap">
                            {new Date(it.date).toLocaleDateString("zh-TW")}
                          </td>
                          <td className="p-2">{it.workerName}</td>
                          <td className="p-2">{it.clientOrWork}</td>
                          <td className="p-2">
                            {it.dayType === "REST_DAY" ? "休息日" : "國定假日"}
                          </td>
                          <td className="p-2 font-mono">{it.workTime}</td>
                          <td className="p-2 text-right">{it.workHours.toFixed(1)}h</td>
                          <td className="p-2 text-right">{it.overtimeHours.toFixed(1)}h</td>
                          <td className="p-2 text-right font-medium">
                            ${it.overtimePay.toLocaleString("zh-TW")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {oe && oe.items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  明細（{oe.items.length} 筆）
                </p>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="text-left">
                        <th className="p-2">日期</th>
                        <th className="p-2">品名</th>
                        <th className="p-2">用途</th>
                        <th className="p-2 text-right">數量</th>
                        <th className="p-2 text-right">單價</th>
                        <th className="p-2 text-right">合計</th>
                        <th className="p-2 text-right">單據</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oe.items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="p-2 whitespace-nowrap">
                            {new Date(it.date).toLocaleDateString("zh-TW")}
                          </td>
                          <td className="p-2">{it.itemName}</td>
                          <td className="p-2">{it.purpose}</td>
                          <td className="p-2 text-right">{it.quantity}</td>
                          <td className="p-2 text-right">
                            ${it.unitPrice.toLocaleString("zh-TW")}
                          </td>
                          <td className="p-2 text-right font-medium">
                            ${it.subtotal.toLocaleString("zh-TW")}
                          </td>
                          <td className="p-2 text-right">{it.receipts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">簽核流程</p>
              {data.approvalActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">無簽核流程</p>
              ) : (() => {
                const rounds = groupByRound(data.approvalActions);
                const totalRounds = rounds.size;
                return (
                  <div className="space-y-3">
                    {Array.from(rounds.entries()).map(([round, actions]) => {
                      const isLatestRound = round === totalRounds;
                      // 判斷本輪是否「退簽」
                      const rejectedAction = actions.find((a) => a.action === "REJECTED");
                      // 判斷本輪是否「取回」：不是最後一輪且沒有退簽 action（不管前面幾關有沒有簽過）
                      const wasWithdrawn = !isLatestRound && !rejectedAction;

                      return (
                        <div key={round} className="rounded-md border overflow-hidden">
                          <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5">
                            <span className="text-xs font-semibold">
                              第 {round} 次申請
                            </span>
                            {wasWithdrawn && (
                              <span className="text-xs text-orange-600 font-medium">↩ 申請人取回重送</span>
                            )}
                            {!wasWithdrawn && rejectedAction && (
                              <span className="text-xs text-red-600 font-medium">✗ 退簽</span>
                            )}
                            {!wasWithdrawn && !rejectedAction && isLatestRound && (
                              <span className="text-xs text-muted-foreground">目前進行中</span>
                            )}
                          </div>
                          <div className="divide-y">
                            {actions.map((a) => (
                              <div key={a.id} className="px-3 py-2 text-sm space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground shrink-0 text-xs">
                                    第 {a.stepOrder} 關
                                  </span>
                                  <span className="flex-1">
                                    <span className="text-muted-foreground text-xs">簽核人：</span>
                                    {a.approver.name ?? a.approver.email}
                                  </span>
                                  <span
                                    className={
                                      !a.action
                                        ? wasWithdrawn ? "text-orange-500" : "text-yellow-600"
                                        : a.action === "APPROVED"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {!a.action
                                      ? wasWithdrawn ? "— 未處理" : "⏳ 等待中"
                                      : actionLabel[a.action] ?? a.action}
                                  </span>
                                </div>
                                {a.actedAt && (
                                  <p className="text-xs text-muted-foreground">
                                    簽核時間：{new Date(a.actedAt).toLocaleString("zh-TW")}
                                  </p>
                                )}
                                {a.comment && (
                                  <p className="text-xs text-muted-foreground">
                                    備註：{a.comment}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showApprovalButtons && data?.status === "PENDING" && (
            <div className="flex gap-2 sm:mr-auto" onClick={(e) => e.stopPropagation()}>
              <ApprovalButtons
                submissionId={data.id}
                onSuccess={() => onOpenChange(false)}
              />
            </div>
          )}
          <Button variant="outline" onClick={handlePrint} disabled={!data}>
            <Printer className="mr-2 h-4 w-4" />
            列印
          </Button>
          <DialogClose render={<Button variant="ghost" />}>關閉</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
