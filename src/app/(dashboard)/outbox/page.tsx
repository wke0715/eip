import { getOutboxItems } from "@/actions/approval";
import { OutboxTabs } from "./outbox-tabs";

export default async function OutboxPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ tab?: string }>;
}) {
  const [{ pending, approved, rejected }, { tab }] = await Promise.all([
    getOutboxItems(),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">寄件匣</h1>
      <OutboxTabs
        pending={pending}
        approved={approved}
        rejected={rejected}
        initialTab={tab}
      />
    </div>
  );
}
