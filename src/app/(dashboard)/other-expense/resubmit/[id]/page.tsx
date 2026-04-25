import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resubmitOtherExpenseRequest } from "@/actions/otherExpense";
import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { toDateStr } from "@/lib/submission-helpers";
import { OtherExpenseForm } from "../../new/other-expense-form";
import type { OtherExpenseItemInput } from "@/lib/validators/otherExpense";

export default async function ResubmitOtherExpensePage({
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
      otherExpenseRequest: {
        include: { items: { orderBy: { date: "asc" } } },
      },
      attachment: true,
    },
  });

  if (
    !submission ||
    submission.applicantId !== session.user.id ||
    submission.status !== "REJECTED" ||
    !submission.otherExpenseRequest ||
    submission.otherExpenseRequest?.deletedAt !== null
  ) {
    notFound();
  }

  const r = submission.otherExpenseRequest;

  const items: OtherExpenseItemInput[] = r.items.map((it) => ({
    date: toDateStr(it.date),
    itemName: it.itemName,
    purpose: it.purpose,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    subtotal: it.subtotal,
    receipts: it.receipts,
  }));

  const boundAction = resubmitOtherExpenseRequest.bind(null, id);
  const maxSizeMb = await getMaxAttachmentSizeMb();

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">修改並重送其他費用申請單</h1>
      <OtherExpenseForm
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
