import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resubmitExpenseReport } from "@/actions/expense";
import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { mapExpenseItems } from "@/lib/submission-helpers";
import { ExpenseForm } from "../../new/expense-form";

export default async function ResubmitExpensePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const submission = await prisma.formSubmission.findUnique({
    where: { id },
    include: {
      expenseReport: {
        include: { items: { orderBy: { date: "asc" } } },
      },
      attachment: true,
    },
  });

  if (
    !submission ||
    submission.applicantId !== session.user.id ||
    submission.status !== "REJECTED" ||
    !submission.expenseReport ||
    submission.expenseReport?.deletedAt !== null
  ) {
    notFound();
  }

  const r = submission.expenseReport;

  const items = mapExpenseItems(r.items);

  const boundAction = resubmitExpenseReport.bind(null, id);
  const maxSizeMb = await getMaxAttachmentSizeMb();

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">修改並重送出差旅費報告單</h1>
      <ExpenseForm
        defaultValues={{
          formNumber: r.formNumber,
          year: r.year,
          month: r.month,
          existingAttachmentName: submission.attachment?.fileName ?? null,
          submissionId: id,
          maxSizeMb,
          items,
        }}
        submitAction={boundAction}
        submitLabel="修改並重送"
      />
    </div>
  );
}
