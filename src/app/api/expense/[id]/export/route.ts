import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExpenseWorkbook } from "@/lib/excel/expense-exporter";
import type { ExpenseItemInput } from "@/lib/validators/expense";

const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

function toDateStr(d: Date) {
  return new Date(d.getTime() + TW_OFFSET_MS).toISOString().slice(0, 10);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await params;

  const submission = await prisma.formSubmission.findUnique({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, role: true } },
      expenseReport: {
        include: { items: { orderBy: { date: "asc" } } },
      },
    },
  });

  if (!submission || !submission.expenseReport) {
    return NextResponse.json({ error: "找不到此報告單" }, { status: 404 });
  }

  // 申請人本人 或 Admin 可匯出
  const isOwner = submission.applicantId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "無權限匯出此報告單" }, { status: 403 });
  }

  const r = submission.expenseReport;
  const items: ExpenseItemInput[] = r.items.map((it) => ({
    date: toDateStr(it.date),
    days: it.days,
    workCategory: it.workCategory as ExpenseItemInput["workCategory"],
    workDetail: it.workDetail,
    mileageSubsidy: it.mileageSubsidy,
    parkingFee: it.parkingFee,
    etcFee: it.etcFee,
    gasFee: it.gasFee,
    transportType: it.transportType as ExpenseItemInput["transportType"],
    transportAmount: it.transportAmount,
    mealType: it.mealType as ExpenseItemInput["mealType"],
    mealAmount: it.mealAmount,
    otherKind: it.otherKind as ExpenseItemInput["otherKind"],
    otherName: it.otherName,
    otherAmount: it.otherAmount,
    subtotal: it.subtotal,
    receipts: it.receipts,
    remark: it.remark,
  }));

  const buffer = buildExpenseWorkbook({
    formNumber: r.formNumber,
    applicantName: submission.applicant.name ?? submission.applicant.email,
    year: r.year,
    month: r.month,
    totalAmount: r.totalAmount,
    totalReceipts: r.totalReceipts,
    items,
  });

  const filename = `${r.formNumber}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
