import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { OvertimeForm } from "./overtime-form";

export default async function NewOvertimePage() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const maxSizeMb = await getMaxAttachmentSizeMb();

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">新增加班單</h1>
      <OvertimeForm
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
