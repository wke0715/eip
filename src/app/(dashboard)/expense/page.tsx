import Link from "next/link";
import { getMyExpenseReports } from "@/actions/expense";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ExpenseTable } from "./expense-table";

export default async function ExpensePage() {
  const submissions = await getMyExpenseReports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">出差旅費報告單</h1>
        <Link href="/expense/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          新增報告單
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的報告單</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseTable submissions={submissions} />
        </CardContent>
      </Card>
    </div>
  );
}
