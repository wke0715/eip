import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { ExpenseForm } from "./expense-form";

export default async function NewExpensePage() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const maxSizeMb = await getMaxAttachmentSizeMb();

  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">新增出差旅費報告單</h1>
      <ExpenseForm
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
