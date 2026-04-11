import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">人員行事曆</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            公司人員行程總覽
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">行事曆功能開發中</p>
            <p className="text-sm mt-1">
              未來可在此檢視公司 / 部門人員的行程與假表
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
