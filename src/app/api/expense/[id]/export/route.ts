import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExpenseWorkbook } from "@/lib/excel/expense-exporter";
import { mapExpenseItems } from "@/lib/submission-helpers";

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

  if (!submission?.expenseReport) {
    return NextResponse.json({ error: "找不到此報告單" }, { status: 404 });
  }

  // 申請人本人 或 Admin 可匯出
  const isOwner = submission.applicantId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "無權限匯出此報告單" }, { status: 403 });
  }

  const r = submission.expenseReport;
  const items = mapExpenseItems(r.items);

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
