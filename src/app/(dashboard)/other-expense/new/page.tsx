import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { OtherExpenseForm } from "./other-expense-form";

export default async function NewOtherExpensePage() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const maxSizeMb = await getMaxAttachmentSizeMb();

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">新增其他費用申請單</h1>
      <OtherExpenseForm
        defaultValues={{
          year: tw.getUTCFullYear(),
          month: tw.getUTCMonth() + 1,
          maxSizeMb,
          items: [],
        }}
      />
    </div>
  );
}
