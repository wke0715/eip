import Link from "next/link";
import { getMyOtherExpenseRequests } from "@/actions/otherExpense";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { OtherExpenseTable } from "./other-expense-table";

export default async function OtherExpensePage() {
  const submissions = await getMyOtherExpenseRequests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">其他費用申請單</h1>
        <Link href="/other-expense/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          新增申請單
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的申請單</CardTitle>
        </CardHeader>
        <CardContent>
          <OtherExpenseTable submissions={submissions} />
        </CardContent>
      </Card>
    </div>
  );
}
