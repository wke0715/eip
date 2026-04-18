import Link from "next/link";
import { getMyOvertimeRequests } from "@/actions/overtime";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { OvertimeTable } from "./overtime-table";

export default async function OvertimePage() {
  const submissions = await getMyOvertimeRequests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">加班單</h1>
        <Link href="/overtime/new" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          新增加班單
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的加班單</CardTitle>
        </CardHeader>
        <CardContent>
          <OvertimeTable submissions={submissions} />
        </CardContent>
      </Card>
    </div>
  );
}
